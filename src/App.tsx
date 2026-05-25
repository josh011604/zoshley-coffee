import { useEffect, useMemo, useState } from 'react';
import { fallbackMenuItems } from './data';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { getCurrentStaffSession, signIn, signOut } from './lib/auth';
import { menuStorageKey, menuSyncEventName, readMenuCache, writeMenuCache } from './lib/menu';
import { categoryStorageKey, categorySyncEventName, readCategoryCache, writeCategoryCache, type CachedCategory } from './lib/categories';
import type { ConnectionState, Fulfillment, MenuItem, OrderFormState } from './types';
import CartSidebar from './components/CartSidebar';
import CheckoutModal from './components/CheckoutModal';
import OrderSuccessModal from './components/OrderSuccessModal';
import type { StaffSession } from './lib/auth';

const deliveryFee = 55;
const taxRate = 0.12;

const openingHours = [
  { day: 'Mon - Thu', time: '7:00 AM - 9:00 PM' },
  { day: 'Fri - Sat', time: '7:00 AM - 10:00 PM' },
  { day: 'Sunday', time: '8:00 AM - 8:00 PM' },
];

const highlights = [
  'Single-origin espresso',
  'Fresh pastries baked daily',
  'Fast pickup and delivery',
  'Private booking for events',
];

const experienceCards = [
  {
    title: 'Brews with intention',
    body: 'We pull espresso shots with a tight ratio, balanced crema, and a clean finish that holds up in milk drinks or iced pours.',
  },
  {
    title: 'A warm place to stay',
    body: 'The cafe is designed for laptop work, quiet meetings, and slow mornings with a pastry and a second cup.',
  },
  {
    title: 'Prepared for the day',
    body: 'We keep the menu focused so every item lands quickly and tastes the same from the first order to the hundredth.',
  },
];

const testimonial = {
  quote: 'The coffee is rich, the pastries are always fresh, and pickup is faster than anywhere else nearby.',
  author: 'Anna, regular customer',
};

const initialOrderForm: OrderFormState = {
  name: '',
  phone: '',
  email: '',
  fulfillment: 'pickup',
  deliveryAddress: '',
  paymentMethod: 'Cash on Delivery',
  notes: '',
};

const initialStaffLogin = {
  login: '',
  password: '',
};

type CheckoutDraft = {
  cart: Record<string, number>;
  orderForm: OrderFormState;
};

const checkoutDraftStorageKey = 'zoshley-checkout-draft';

const readCheckoutDraft = (): CheckoutDraft | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(checkoutDraftStorageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<CheckoutDraft>;
    if (!parsed || typeof parsed !== 'object') return null;

    const cart = parsed.cart && typeof parsed.cart === 'object' ? Object.fromEntries(
      Object.entries(parsed.cart)
        .map(([id, quantity]) => [String(id), Math.max(0, Number(quantity) || 0)])
        .filter(([, quantity]) => quantity > 0),
    ) : {};

    const orderForm: OrderFormState = parsed.orderForm && typeof parsed.orderForm === 'object'
      ? {
          ...initialOrderForm,
          ...parsed.orderForm,
          name: String(parsed.orderForm.name ?? ''),
          phone: String(parsed.orderForm.phone ?? ''),
          email: String(parsed.orderForm.email ?? ''),
          fulfillment: (parsed.orderForm.fulfillment === 'delivery' ? 'delivery' : 'pickup') as Fulfillment,
          deliveryAddress: String(parsed.orderForm.deliveryAddress ?? ''),
          deliveryLat: parsed.orderForm.deliveryLat ?? null,
          deliveryLng: parsed.orderForm.deliveryLng ?? null,
          paymentMethod: (parsed.orderForm.paymentMethod ?? initialOrderForm.paymentMethod) as OrderFormState['paymentMethod'],
          notes: String(parsed.orderForm.notes ?? ''),
        }
      : initialOrderForm;

    return { cart, orderForm };
  } catch {
    return null;
  }
};

const writeCheckoutDraft = (draft: CheckoutDraft) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(checkoutDraftStorageKey, JSON.stringify(draft));
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
};

const clearCheckoutDraft = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(checkoutDraftStorageKey);
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
};

const categoryOrder = ['All', 'Espresso', 'Milk Drinks', 'Cold Brew', 'Bakery', 'Food'];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);

const deriveIcon = (item: MenuItem) => {
  if (item.icon) return item.icon;
  if (item.category.toLowerCase().includes('bak')) return '🥐';
  if (item.category.toLowerCase().includes('food')) return '🥪';
  if (item.category.toLowerCase().includes('cold')) return '🧊';
  return '☕';
};

const normalizeMenuItem = (row: Partial<MenuItem> & { id: string }): MenuItem => ({
  id: String(row.id),
  name: row.name ?? 'Untitled Item',
  description: row.description ?? 'Freshly prepared in the cafe.',
  category: row.category ?? 'Espresso',
  price: Number(row.price ?? 0),
  featured: Boolean(row.featured),
  is_available: row.is_available ?? true,
  icon: row.icon,
  prep_time: row.prep_time,
});

const mergeCategoriesById = (cachedCategories: CachedCategory[], remoteCategories: CachedCategory[]) => {
  const byId = new Map<string, CachedCategory>();

  for (const category of remoteCategories) {
    byId.set(category.id, category);
  }

  for (const category of cachedCategories) {
    byId.set(category.id, category);
  }

  return Array.from(byId.values());
};

const getDeliveryDetails = (address: string, lat?: number | null, lng?: number | null) => {
  const normalized = address.trim().toLowerCase();
  // Cafe coordinates (approx)
  const cafeLat = 14.6498;
  const cafeLng = 121.0509;

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (lat != null && lng != null) {
    const distKm = haversineKm(cafeLat, cafeLng, lat, lng);
    const base = 35; // base service fee
    const perKm = 8; // per km
    const fee = Math.min(150, Math.max(35, Math.round((base + perKm * distKm) / 5) * 5));
    const etaMin = Math.max(25, Math.round(15 + distKm * 4));
    return {
      zone: `${distKm.toFixed(1)} km from cafe`,
      fee,
      eta: `${etaMin}–${etaMin + 15} min`,
      note: 'Calculated from selected pin; final ETA may vary.',
    };
  }
  if (!normalized) {
    return {
      zone: 'Standard delivery zone',
      fee: deliveryFee,
      eta: 'Estimate after address is entered',
      note: 'Enter your exact delivery location for a better quote.',
    };
  }

  if (normalized.includes('makati') || normalized.includes('taguig') || normalized.includes('bonifacio') || normalized.includes('bgc')) {
    return {
      zone: 'Metro Manila express',
      fee: 75,
      eta: '45–55 min',
      note: 'Premium urban delivery with live route optimization.',
    };
  }

  if (normalized.includes('quezon') || normalized.includes('diliman') || normalized.includes('up') || normalized.includes('katipunan') || normalized.includes('san juan')) {
    return {
      zone: 'Quezon City delivery zone',
      fee: 55,
      eta: '30–40 min',
      note: 'Fast delivery within the local cafe district.',
    };
  }

  if (normalized.includes('pasig') || normalized.includes('marikina') || normalized.includes('mandaluyong')) {
    return {
      zone: 'East Metro route',
      fee: 65,
      eta: '40–50 min',
      note: 'Extended delivery zone with an extra service charge.',
    };
  }

  if (normalized.includes('tinibgan')) {
    return {
      zone: 'Tinibgan delivery route',
      fee: 70,
      eta: '45–55 min',
      note: 'Covered by the inland barangay delivery route.',
    };
  }

  return {
    zone: 'Nearby service area',
    fee: 80,
    eta: '45–60 min',
    note: 'Your address is still within reach, but delivery takes a little longer.',
  };
};

export default function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => readMenuCache() ?? fallbackMenuItems);
  const [cachedCategories, setCachedCategories] = useState(() => readCategoryCache() ?? []);
  const [category, setCategory] = useState('All');
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [banner, setBanner] = useState('Checking live menu source...');
  const [orderForm, setOrderForm] = useState<OrderFormState>(() => readCheckoutDraft()?.orderForm ?? initialOrderForm);
  const [cart, setCart] = useState<Record<string, number>>(() => readCheckoutDraft()?.cart ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState('');
  const [staffLoginForm, setStaffLoginForm] = useState(initialStaffLogin);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccessOpen, setOrderSuccessOpen] = useState(false);
  const [lastOrderCode, setLastOrderCode] = useState('');
  const [lastOrderFulfillment, setLastOrderFulfillment] = useState<Fulfillment>('pickup');
  const [lastOrderDeliveryAddress, setLastOrderDeliveryAddress] = useState('');
  const [whatsNewOpen, setWhatsNewOpen] = useState(true);

  const mergeMenuItems = (cachedItems: MenuItem[], remoteItems: MenuItem[]) => {
    const byId = new Map<string, MenuItem>();

    for (const item of remoteItems) {
      byId.set(item.id, item);
    }

    for (const item of cachedItems) {
      byId.set(item.id, item);
    }

    return Array.from(byId.values());
  };

  useEffect(() => {
    let mounted = true;

    const loadMenu = async () => {
      if (!supabase) {
        if (mounted) {
          setConnectionState('demo');
          setBanner('Menu is running locally. Live menu will appear when configured.');
        }
        return;
      }

      const { data, error } = await supabase
        .from('menu_items')
        .select('id,name,description,category,price,featured,is_available')
        .order('featured', { ascending: false })
        .order('name', { ascending: true });

      if (!mounted) return;

      if (error || !data?.length) {
        setConnectionState('demo');
        setBanner('Live menu is not configured yet. Showing local selections.');
        return;
      }

      const remoteMenu = (data as any[]).map((row) => normalizeMenuItem(row));
      const cachedMenu = readMenuCache() ?? [];
      const nextMenu = mergeMenuItems(cachedMenu, remoteMenu);
      setMenuItems(nextMenu);
      writeMenuCache(nextMenu);
      setConnectionState('connected');
      setBanner('Live menu loaded from Supabase.');
    };

    void loadMenu();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      if (!supabase) return;

      const { data, error } = await supabase.from('categories').select('id,name,parent').order('name', { ascending: true });
      if (!mounted || error || !data?.length) return;

      const remoteCategories = data.map((item) => ({
        id: String(item.id),
        name: String(item.name ?? 'Untitled Category'),
        parent: item.parent ? String(item.parent) : undefined,
      }));
      const cached = readCategoryCache() ?? [];
      const nextCategories = mergeCategoriesById(cached, remoteCategories);
      setCachedCategories(nextCategories);
      writeCategoryCache(nextCategories);
    };

    void loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncFromCache = () => {
      const cachedMenu = readMenuCache();
      if (cachedMenu !== null) {
        setMenuItems(cachedMenu);
      }
    };

    const syncCategoriesFromCache = () => {
      const nextCategories = readCategoryCache() ?? [];
      setCachedCategories(nextCategories);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === menuStorageKey) {
        syncFromCache();
      }
      if (event.key === null || event.key === categoryStorageKey) {
        syncCategoriesFromCache();
      }
    };

    window.addEventListener(menuSyncEventName, syncFromCache);
    window.addEventListener(categorySyncEventName, syncCategoriesFromCache);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(menuSyncEventName, syncFromCache);
      window.removeEventListener(categorySyncEventName, syncCategoriesFromCache);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    writeCheckoutDraft({ cart, orderForm });
  }, [cart, orderForm]);

  const categories = useMemo(() => {
    const dynamicCategories = Array.from(new Set([...menuItems.map((item) => item.category), ...cachedCategories.map((item) => item.name)]));
    return categoryOrder.filter((item) => item === 'All' || dynamicCategories.includes(item)).concat(
      dynamicCategories.filter((item) => !categoryOrder.includes(item)),
    );
  }, [menuItems, cachedCategories]);

  const visibleMenu = menuItems.filter((item) => (category === 'All' ? true : item.category === category));
  const featuredMenu = useMemo(() => menuItems.filter((item) => item.featured).slice(0, 3), [menuItems]);

  const cartItems = menuItems
    .filter((item) => (cart[item.id] ?? 0) > 0)
    .map((item) => ({ ...item, quantity: cart[item.id] ?? 0 }));

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  const deliveryInfo = getDeliveryDetails(orderForm.deliveryAddress, orderForm.deliveryLat ?? null, orderForm.deliveryLng ?? null);
  const selectedDeliveryFee = orderForm.fulfillment === 'delivery' ? deliveryInfo.fee : 0;
  const total = subtotal + tax + selectedDeliveryFee;
  const canPlaceOrder = Boolean(
    orderForm.name.trim() && orderForm.phone.trim() && cartItems.length > 0 && orderForm.paymentMethod && !submitting && (orderForm.fulfillment === 'pickup' || orderForm.deliveryAddress.trim()),
  );

  const updateForm = (field: keyof OrderFormState, value: string) => {
    setOrderForm((current) => ({ ...current, [field]: value }));
  };

  const setDeliveryLocation = (address: string, lat: number | null, lng: number | null) => {
    setOrderForm((current) => ({ ...current, deliveryAddress: address, deliveryLat: lat, deliveryLng: lng }));
  };

  const changeQuantity = (id: string, delta: number) => {
    setCart((current) => {
      const nextValue = Math.max(0, (current[id] ?? 0) + delta);
      const next = { ...current };

      if (nextValue === 0) {
        delete next[id];
        return next;
      }

      next[id] = nextValue;
      return next;
    });
  };

  const clearCart = () => setCart({});

  const openCheckout = () => setCheckoutOpen(true);
  const closeCheckout = () => setCheckoutOpen(false);
  const closeSuccess = () => setOrderSuccessOpen(false);

  const createOrderCode = () => `ORD-${Date.now().toString().slice(-6)}`;

  const formatEstimatedDelivery = (fulfillment: Fulfillment = lastOrderFulfillment, address: string = lastOrderDeliveryAddress) => {
    if (fulfillment === 'delivery') {
      const normalized = address.trim().toLowerCase();
      if (!normalized) return 'Estimate available after address is entered.';
      if (normalized.includes('makati') || normalized.includes('taguig') || normalized.includes('bonifacio') || normalized.includes('bgc')) return '45–55 min';
      if (normalized.includes('quezon') || normalized.includes('diliman') || normalized.includes('up') || normalized.includes('katipunan') || normalized.includes('san juan')) return '30–40 min';
      if (normalized.includes('tinibgan')) return '45–55 min';
      return '40–50 min';
    }
    return 'Ready in 10 min';
  };

  

  useEffect(() => {
    let mounted = true;

    const restoreStaffSession = async () => {
      const session = await getCurrentStaffSession();
      if (!mounted) return;
      setStaffSession(session);
    };

    void restoreStaffSession();

    return () => {
      mounted = false;
    };
  }, []);

  const openStaffLogin = () => {
    setStaffLoginError('');
    setStaffLoginOpen(true);
  };

  const closeStaffLogin = () => {
    setStaffLoginOpen(false);
    setStaffLoginError('');
    setStaffLoginForm(initialStaffLogin);
  };

  const submitStaffLogin = async () => {
    const loginValue = staffLoginForm.login.trim();
    const password = staffLoginForm.password;

    if (!loginValue || !password) {
      setStaffLoginError('Username/email and password are required.');
      return;
    }

    const result = await signIn(loginValue, password);
    if (result.error || !result.session) {
      setStaffLoginError(result.error ?? 'Sign in failed.');
      return;
    }

    setStaffSession(result.session);
    setBanner(`${result.session.role === 'admin' ? 'Admin' : 'Staff'} access granted for ${result.session.name}.`);
    closeStaffLogin();
    if (result.session.role === 'admin') {
      window.location.hash = '/admin';
    }
  };

  const logoutStaff = async () => {
    await signOut();
    setStaffSession(null);
    setBanner('Staff session ended.');
  };

  const placeOrder = async () => {
    if (!orderForm.name.trim() || !orderForm.phone.trim()) {
      setBanner('Add a customer name and phone number before placing the order.');
      return;
    }

    if (!cartItems.length) {
      setBanner('Add at least one menu item to the cart first.');
      return;
    }

    setSubmitting(true);

    const payload: any = {
      customer_name: orderForm.name.trim(),
      customer_phone: orderForm.phone.trim(),
      customer_email: orderForm.email.trim() || null,
      fulfillment: orderForm.fulfillment,
      notes: orderForm.notes.trim() || null,
      // delivery coords are optional; enable via REACT_APP_INCLUDE_DELIVERY_COORDS=true
      // This avoids insert failures when the DB schema doesn't have these columns yet.
      items: cartItems.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
      subtotal,
      tax,
      delivery_fee: selectedDeliveryFee,
      total,
      status: 'new',
    };

    if (process.env.REACT_APP_INCLUDE_DELIVERY_COORDS === 'true' && orderForm.deliveryLat != null && orderForm.deliveryLng != null) {
      payload.delivery_lat = orderForm.deliveryLat;
      payload.delivery_lng = orderForm.deliveryLng;
    }

    if (!supabase) {
      setBanner('Local mode only. Connect Supabase to store this order.');
      setSubmitting(false);
      return;
    }

    let resultError = null as any;

    try {
      const res = await supabase.from('orders').insert(payload);
      resultError = res.error;
    } catch (e) {
      resultError = e;
    }

    // If the insert failed due to missing delivery columns, retry without coords
    if (resultError) {
      const msg = String(resultError.message ?? resultError);
      const missingCoords = /delivery_lat|delivery_lng|Could not find the 'delivery_lat'|Could not find the 'delivery_lng'|column "delivery_lat" of relation "orders" does not exist/i.test(msg);
      if (missingCoords) {
        const { delivery_lat, delivery_lng, ...payloadWithoutCoords } = payload as any;
        try {
          const retry = await supabase.from('orders').insert(payloadWithoutCoords);
          resultError = retry.error;
        } catch (e) {
          resultError = e;
        }
      }
    }

    if (resultError) {
      setBanner(`Order save failed: ${String(resultError.message ?? resultError)}`);
      setSubmitting(false);
      return;
    }

    setCart({});
    setLastOrderCode(createOrderCode());
    setLastOrderFulfillment(orderForm.fulfillment);
    setLastOrderDeliveryAddress(orderForm.deliveryAddress);
    setOrderSuccessOpen(true);
    setOrderForm(initialOrderForm);
    clearCheckoutDraft();
    setBanner('Order saved to Supabase.');
    setSubmitting(false);
    closeCheckout();
  };

  const staffButtonLabel = staffSession ? 'Logout' : 'Staff login';

  return (
    <>
      <main className="min-h-screen bg-[#0f0906] text-cream">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,185,76,0.14),transparent_28%),radial-gradient(circle_at_right,rgba(110,61,29,0.18),transparent_32%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-black/20 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-2xl">☕</div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cream/45">Zoshley Coffee Shop</p>
                  <h1 className="font-display text-2xl text-cream">A neighborhood cafe for slow mornings and strong coffee.</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-cream/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{connectionState === 'connected' ? 'Live menu' : 'Menu'}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Pickup, delivery, and custom orders</span>
                <button
                  type="button"
                  onClick={() => {
                    if (staffSession) {
                      void logoutStaff();
                      return;
                    }
                    openStaffLogin();
                  }}
                  className="rounded-full bg-gold px-4 py-2 font-semibold text-coffee-950 transition hover:brightness-110"
                >
                  {staffButtonLabel}
                </button>
                
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-12">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a100b] to-[#090604] p-6 shadow-2xl shadow-black/30 lg:p-8">
              {staffSession?.role === 'admin' ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  {banner}
                </div>
              ) : null}

              {whatsNewOpen && (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-4 text-sm text-cream/85">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="block text-base">What’s new</strong>
                      <ul className="mt-2 ml-4 list-disc">
                        <li>Checkout improved: accepts typed address (Enter) and retries if delivery coords are unavailable.</li>
                        <li>Database migration added: `delivery_lat` and `delivery_lng` now available for orders.</li>
                        <li>Map autocomplete and preview improved for delivery selection.</li>
                        <li>CI and deploy configs added for automated builds.</li>
                      </ul>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setWhatsNewOpen(false)}
                        className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-cream/60"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cream/45">Fresh roasted coffee, pastries, and brunch</p>
                  <h2 className="mt-4 max-w-2xl font-display text-5xl leading-none text-cream sm:text-6xl">
                    Crafted like a real cafe, built to run orders and staff access.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-cream/75">
                    A warm, modern storefront for your coffee shop with a live Supabase menu, ordering flow, and staff-only access for managing the back counter.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {highlights.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream/75">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Cafe hours</p>
                      <p className="mt-1 font-display text-2xl text-cream">Open daily</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-cream/65">Today</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {openingHours.map((entry) => (
                      <div key={entry.day} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                        <span className="text-cream/70">{entry.day}</span>
                        <span className="font-semibold text-cream">{entry.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <section className="grid gap-4 md:grid-cols-3">
              {experienceCards.map((card) => (
                <article key={card.title} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <h3 className="font-display text-2xl text-cream">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-cream/68">{card.body}</p>
                </article>
              ))}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cream/45">Signature drinks</p>
                  <h3 className="mt-2 font-display text-3xl text-cream">The menu that feels like a real cafe board</h3>
                </div>
                <p className="max-w-xl text-sm leading-7 text-cream/65">
                  Pull espresso, pour-over, milk drinks, and fresh bakery items. The list below is driven by Supabase when the table is present.
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {featuredMenu.map((item) => (
                  <article key={item.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-gold/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/12 text-xl">{deriveIcon(item)}</div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-cream/45">{item.category}</p>
                          <h4 className="mt-1 font-semibold text-cream">{item.name}</h4>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gold">{formatCurrency(item.price)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-cream/68">{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-cream/45">Visit us</p>
                <h3 className="mt-2 font-display text-3xl text-cream">Cafe details</h3>
                <div className="mt-4 space-y-3 text-sm text-cream/72">
                  <p>123 Brew Lane, Quezon City</p>
                  <p>+63 912 345 6789</p>
                  <p>hello@zoshleycoffee.com</p>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-cream/68">
                  We’re optimized for dine-in, grab-and-go, and order-ahead pickup.
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cream/45">What people say</p>
                    <h3 className="mt-2 font-display text-3xl text-cream">Customer note</h3>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-cream/60">Fresh feedback</div>
                </div>
                <blockquote className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-lg leading-8 text-cream/80">
                  “{testimonial.quote}”
                </blockquote>
                <p className="mt-4 text-sm text-cream/55">{testimonial.author}</p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Live orders</p>
                  <h3 className="mt-2 font-display text-3xl text-cream">Build your order</h3>
                </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-cream/60">
                  {isSupabaseConfigured ? connectionState : 'Local'}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      category === item
                        ? 'border-gold bg-gold text-coffee-950'
                        : 'border-white/10 bg-black/20 text-cream/70 hover:border-gold/30 hover:text-cream'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-4">
                {visibleMenu.map((item) => (
                  <article key={item.id} className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl">{deriveIcon(item)}</div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-cream/45">{item.category}</p>
                          <h4 className="mt-1 font-semibold text-cream">{item.name}</h4>
                        </div>
                      </div>
                      {item.featured ? <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">Featured</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-cream/68">{item.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-semibold text-cream">{formatCurrency(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, 1)}
                        className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-coffee-950 transition hover:brightness-110"
                      >
                        Add
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <CartSidebar
              cartItems={cartItems}
              subtotal={subtotal}
              tax={tax}
              deliveryFee={selectedDeliveryFee}
              total={total}
              fulfillment={orderForm.fulfillment}
              onChangeQuantity={changeQuantity}
              onOpenCheckout={openCheckout}
              onClearCart={clearCart}
            />

            <CheckoutModal
              isOpen={checkoutOpen}
              orderForm={orderForm}
              cartItems={cartItems}
              subtotal={subtotal}
              tax={tax}
              deliveryFee={selectedDeliveryFee}
              total={total}
              onClose={closeCheckout}
              onUpdateForm={updateForm}
              onSetDeliveryLocation={setDeliveryLocation}
              onSubmit={placeOrder}
              submitting={submitting}
              canSubmit={canPlaceOrder}
            />
            <OrderSuccessModal
              isOpen={orderSuccessOpen}
              orderCode={lastOrderCode}
              fulfillment={lastOrderFulfillment}
              estimatedDeliveryTime={formatEstimatedDelivery(lastOrderFulfillment)}
              onClose={closeSuccess}
            />

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Staff console</p>
                  <h3 className="mt-2 font-display text-3xl text-cream">Admin and staff access</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (staffSession) {
                      void logoutStaff();
                      return;
                    }
                    openStaffLogin();
                  }}
                  className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-coffee-950"
                >
                  {staffButtonLabel}
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-cream/65">
                Staff access is powered by Supabase Auth and a profiles table. Only accounts marked as <span className="font-semibold text-cream">admin</span> or{' '}
                <span className="font-semibold text-cream">staff</span> can unlock this console.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cream/45">Status</div>
                  <div className="mt-2 text-lg font-semibold text-cream">{staffSession ? 'Authenticated' : 'Locked'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cream/45">Role</div>
                  <div className="mt-2 text-lg font-semibold text-cream">{staffSession ? staffSession.role : 'Admin / staff'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cream/45">Account</div>
                  <div className="mt-2 text-lg font-semibold text-cream">{staffSession ? staffSession.email : 'Supabase user'}</div>
                </div>
              </div>
              {staffSession ? (
                <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm text-cream/80">
                  Signed in as <span className="font-semibold text-cream">{staffSession.name}</span>.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4 text-sm text-cream/60">
                  Sign in to view the staff console.
                </div>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => (window.location.hash = '/admin')}
                  className="mt-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream/70"
                >
                  Open admin page
                </button>
              </div>
            </section>
          </aside>
        </section>

        <footer className="border-t border-white/10 bg-black/20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-cream/65 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div>
              <p className="font-display text-2xl text-cream">Zoshley Coffee Shop</p>
              <p className="mt-2 max-w-md leading-7">
                A real cafe-style storefront with menu, ordering, hours, location, and staff access built on React, Tailwind, and Supabase.
              </p>
            </div>
            <div>
              <p className="font-semibold text-cream">Visit</p>
              <p className="mt-2 leading-7">123 Brew Lane, Quezon City</p>
              <p className="leading-7">hello@zoshleycoffee.com</p>
            </div>
            <div>
              <p className="font-semibold text-cream">Open</p>
              <p className="mt-2 leading-7">Mon - Thu: 7AM - 9PM</p>
              <p className="leading-7">Fri - Sat: 7AM - 10PM</p>
            </div>
          </div>
        </footer>
      </main>

      {staffLoginOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={closeStaffLogin} role="presentation">
          <div
            className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-coffee-900 p-6 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-cream/45">Staff login</div>
                <h3 className="mt-2 font-display text-3xl text-cream">Admin / staff access</h3>
              </div>
              <button type="button" onClick={closeStaffLogin} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-cream/70">
                Close
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitStaffLogin();
              }}
            >
              <label className="block space-y-2 text-sm text-cream/70">
                <span className="font-semibold text-cream">Username or email</span>
                <input
                  value={staffLoginForm.login}
                  onChange={(event) => setStaffLoginForm((current) => ({ ...current, login: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-cream outline-none transition placeholder:text-cream/30 focus:border-gold/60"
                  placeholder="username or admin@zoshleycoffee.com"
                  autoComplete="username"
                />
              </label>

              <label className="block space-y-2 text-sm text-cream/70">
                <span className="font-semibold text-cream">Password</span>
                <input
                  value={staffLoginForm.password}
                  onChange={(event) => setStaffLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-cream outline-none transition placeholder:text-cream/30 focus:border-gold/60"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </label>

              {staffLoginError ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{staffLoginError}</p> : null}

              <button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-gold via-amber-500 to-ember px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-coffee-950 transition hover:brightness-110"
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
