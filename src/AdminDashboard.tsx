import React, { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { signIn, signOut, getCurrentStaffSession, StaffSession as AuthStaffSession } from './lib/auth';
import { emitMenuSync, readMenuCache, writeMenuCache } from './lib/menu';
import { emitCategorySync, readCategoryCache, writeCategoryCache } from './lib/categories';
import type { MenuItem } from './types';
import AdminLoginPanel from './components/AdminLoginPanel';

type StaffRole = 'admin' | 'staff';

type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'staff'
  | 'reports'
  | 'reviews';

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  fulfillment: string;
  status: string;
  total: number;
  created_at: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
};

type InventoryRow = {
  id: string;
  product: string;
  stock: number;
  threshold: number;
  lastUpdated: string;
};

type CategoryRow = {
  id: string;
  name: string;
  parent?: string;
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: StaffRole | null;
};

type ReviewRow = {
  id: string;
  customer: string;
  product: string;
  rating: number;
  comment: string;
  date: string;
};

type EditModalState =
  | {
      kind: 'product';
      id: string;
      name: string;
      description: string;
      category: string;
      price: string;
      featured: boolean;
      is_available: boolean;
    }
  | {
      kind: 'category';
      id: string;
      name: string;
      parent: string;
    }
  | {
      kind: 'staff';
      id: string;
      name: string;
      email: string;
      role: StaffRole;
    }
  | null;

type SyncStatus = {
  label: string;
  state: 'idle' | 'saving' | 'saved' | 'error';
};

const sampleOrders: OrderRow[] = [
  {
    id: 'ORD-3241',
    customer_name: 'Anna Santos',
    customer_phone: '+63 917 123 4567',
    fulfillment: 'pickup',
    status: 'new',
    total: 325,
    created_at: '2026-05-24T10:18:00Z',
  },
  {
    id: 'ORD-3240',
    customer_name: 'Miguel Cruz',
    customer_phone: '+63 917 987 6543',
    fulfillment: 'delivery',
    status: 'preparing',
    total: 455,
    created_at: '2026-05-24T09:58:00Z',
  },
  {
    id: 'ORD-3239',
    customer_name: 'Bea Reyes',
    customer_phone: '+63 917 222 3344',
    fulfillment: 'pickup',
    status: 'ready',
    total: 215,
    created_at: '2026-05-24T09:12:00Z',
  },
];

const sampleProducts: MenuItem[] = [
  { id: '1', name: 'Cappuccino', description: 'Milk-forward espresso with foam', category: 'Espresso', price: 135, featured: true, is_available: true },
  { id: '2', name: 'Vanilla Latte', description: 'Creamy espresso with vanilla syrup', category: 'Milk Drinks', price: 145, featured: false, is_available: true },
  { id: '3', name: 'Butter Croissant', description: 'Flaky pastry with rich butter layers', category: 'Bakery', price: 80, featured: false, is_available: true },
];

const sampleCategories: CategoryRow[] = [
  { id: 'espresso', name: 'Espresso' },
  { id: 'milk', name: 'Milk Drinks' },
  { id: 'bakery', name: 'Bakery' },
  { id: 'food', name: 'Food' },
  { id: 'seasonal', name: 'Seasonal', parent: 'milk' },
];

const sampleInventory: InventoryRow[] = [
  { id: '6d0a8e49-0fa4-4a23-9de5-8e4a4a7d0f01', product: 'Espresso Beans', stock: 12, threshold: 8, lastUpdated: '2026-05-24 08:20' },
  { id: '6d0a8e49-0fa4-4a23-9de5-8e4a4a7d0f02', product: 'Milk', stock: 18, threshold: 12, lastUpdated: '2026-05-24 07:50' },
  { id: '6d0a8e49-0fa4-4a23-9de5-8e4a4a7d0f03', product: 'Butter Croissant', stock: 5, threshold: 6, lastUpdated: '2026-05-24 09:15' },
];

const inventoryStorageKey = 'zoshley-inventory';

const formatInventoryTimestamp = (value?: string | null) => {
  if (!value) {
    return new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const createInventoryId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sampleStaff: StaffRow[] = [
  { id: 'staff-1', name: 'Rita Bautista', email: 'rita@zoshleycoffee.com', role: 'admin' },
  { id: 'staff-jireh', name: 'Jireh', email: 'jireh@zoshleycoffee.com', role: 'admin' },
  { id: 'staff-2', name: 'Maria Santos', email: 'maria@zoshley.com', role: 'staff' },
  { id: 'staff-3', name: 'Juan dela Cruz', email: 'juan@zoshley.com', role: 'staff' },
];

const sampleReviews: ReviewRow[] = [
  { id: 'rvw-001', customer: 'Anna Santos', product: 'Cappuccino', rating: 5, comment: 'Perfect texture and balance.', date: '2026-05-23' },
  { id: 'rvw-002', customer: 'Miguel Cruz', product: 'Cold Brew', rating: 4, comment: 'Smooth and not too bitter.', date: '2026-05-22' },
  { id: 'rvw-003', customer: 'Bea Reyes', product: 'Butter Croissant', rating: 5, comment: 'Flaky and fresh every time.', date: '2026-05-21' },
];

const tabs: { id: AdminTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products/Services' },
  { id: 'categories', label: 'Categories' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff', label: 'Staff' },
  { id: 'reports', label: 'Reports' },
  { id: 'reviews', label: 'Reviews' },
];

const staffTabs: { id: AdminTab; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'reports', label: 'Reports' },
  { id: 'reviews', label: 'Reviews' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (date: string) => new Date(date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusStyles: Record<string, string> = {
  new: 'bg-emerald-500/10 text-emerald-200',
  confirmed: 'bg-sky-500/10 text-sky-200',
  preparing: 'bg-amber-500/10 text-amber-200',
  ready: 'bg-violet-500/10 text-violet-200',
  out_for_delivery: 'bg-cyan-500/10 text-cyan-200',
  completed: 'bg-green-500/10 text-green-200',
  cancelled: 'bg-red-500/10 text-red-200',
};

const orderTimeline = (status: string) => [
  { label: 'Order received', active: true },
  { label: 'Confirmed', active: status !== 'new' },
  { label: 'Prepared', active: ['ready', 'out_for_delivery', 'completed'].includes(status) },
  { label: 'Completed', active: status === 'completed' },
];

const mergeProductsById = (cachedProducts: MenuItem[], remoteProducts: MenuItem[]) => {
  const byId = new Map<string, MenuItem>();

  for (const product of remoteProducts) {
    byId.set(product.id, product);
  }

  for (const product of cachedProducts) {
    byId.set(product.id, product);
  }

  return Array.from(byId.values());
};

const mergeCategoriesById = (cachedCategories: CategoryRow[], remoteCategories: CategoryRow[]) => {
  const byId = new Map<string, CategoryRow>();

  for (const category of remoteCategories) {
    byId.set(category.id, category);
  }

  for (const category of cachedCategories) {
    byId.set(category.id, category);
  }

  return Array.from(byId.values());
};

const AdminDashboard: React.FC = () => {
  const [staffSession, setStaffSession] = useState<AuthStaffSession | null>(null);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [selectedLoginRole, setSelectedLoginRole] = useState<StaffRole | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [orders, setOrders] = useState<OrderRow[]>(sampleOrders);
  const [products, setProducts] = useState<MenuItem[]>(() => readMenuCache() ?? sampleProducts);
  const [categories, setCategories] = useState<CategoryRow[]>(() => readCategoryCache() ?? sampleCategories);
  const [inventory, setInventory] = useState<InventoryRow[]>(() => {
    if (typeof window === 'undefined') return sampleInventory;
    try {
      const stored = window.localStorage.getItem(inventoryStorageKey);
      if (!stored) return sampleInventory;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return sampleInventory;
      return parsed
        .filter((item) => item && item.product)
        .map((item) => ({
          id: String(item.id ?? createInventoryId()),
          product: String(item.product),
          stock: Number.isFinite(Number(item.stock)) ? Math.max(0, Number(item.stock)) : 0,
          threshold: Number.isFinite(Number(item.threshold)) ? Math.max(0, Number(item.threshold)) : 0,
          lastUpdated: String(item.lastUpdated ?? formatInventoryTimestamp()),
        }));
    } catch {
      return sampleInventory;
    }
  });
  const [staffList, setStaffList] = useState<StaffRow[]>(sampleStaff);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState<{ name: string; email: string; role: StaffRole }>({ name: '', email: '', role: 'staff' });
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ label: 'Ready to save', state: 'idle' });

  const getAdminApiHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = process.env.REACT_APP_ADMIN_API_SECRET;

    if (secret) {
      headers['x-admin-secret'] = secret;
    }

    if (!supabase) {
      return headers;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  const overview = useMemo(
    () => ({
      ordersToday: orders.filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString()).length,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      pending: orders.filter((order) => ['new', 'confirmed', 'preparing'].includes(order.status)).length,
    }),
    [orders],
  );

  const persistProducts = async (updater: (current: MenuItem[]) => MenuItem[]) => {
    setSyncStatus({ label: 'Saving products', state: 'saving' });
    setProducts((current) => {
      const nextProducts = updater(current);

      writeMenuCache(nextProducts);
      emitMenuSync();

      void (async () => {
        try {
          const response = await fetch('/api/menu-items', {
            method: 'POST',
            headers: await getAdminApiHeaders(),
            body: JSON.stringify({
              products: nextProducts.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                category: item.category,
                price: item.price,
                featured: Boolean(item.featured),
                is_available: item.is_available ?? true,
                image_url: item.icon ?? null,
                prep_time: item.prep_time ?? null,
              })),
            }),
          });

          if (!response.ok) {
            throw new Error(await response.text());
          }
        } catch {
          // Keep the local edit even if the server sync is unavailable.
        }
      })();

      setSyncStatus({ label: 'Products saved', state: 'saved' });

      return nextProducts;
    });
  };

  const addProduct = () => {
    const nextIndex = products.length + 1;
    void persistProducts((current) => [
      {
        id: `product-${Date.now()}`,
        name: `New Product ${nextIndex}`,
        description: 'Created from the admin dashboard.',
        category: categories[0]?.name || 'Espresso',
        price: 0,
        featured: false,
        is_available: true,
      },
      ...current,
    ]);
  };

  const editProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setEditModal({
      kind: 'product',
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      featured: Boolean(product.featured),
      is_available: Boolean(product.is_available),
    });
  };

  const deleteProduct = (productId: string) => {
    void persistProducts((current) => current.filter((product) => product.id !== productId));
  };

  const addCategory = () => {
    const nextIndex = categories.length + 1;
    setSyncStatus({ label: 'Saving categories', state: 'saving' });
    setCategories((current) => {
      const nextCategories = [{ id: `category-${Date.now()}`, name: `New Category ${nextIndex}`, parent: undefined }, ...current];
      writeCategoryCache(nextCategories);
      emitCategorySync();
      setSyncStatus({ label: 'Categories saved', state: 'saved' });
      return nextCategories;
    });
  };

  const editCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    setEditModal({
      kind: 'category',
      id: category.id,
      name: category.name,
      parent: category.parent ?? '',
    });
  };

  const addStockLog = () => {
    void persistInventory((current) => [
      {
        id: createInventoryId(),
        product: `New Inventory Item ${current.length + 1}`,
        stock: 0,
        threshold: 0,
        lastUpdated: formatInventoryTimestamp(),
      },
      ...current,
    ]);
  };

  const adjustInventoryStock = (inventoryId: string, delta: number) => {
    void persistInventory((current) =>
      current.map((item) =>
        item.id === inventoryId
          ? {
              ...item,
              stock: Math.max(0, item.stock + delta),
              lastUpdated: formatInventoryTimestamp(),
            }
          : item,
      ),
    );
  };

  const updateInventoryItem = (inventoryId: string, updates: Partial<Pick<InventoryRow, 'product' | 'stock' | 'threshold'>>) => {
    void persistInventory((current) =>
      current.map((item) =>
        item.id === inventoryId
          ? {
              ...item,
              product: updates.product ?? item.product,
              stock: updates.stock != null ? Math.max(0, updates.stock) : item.stock,
              threshold: updates.threshold != null ? Math.max(0, updates.threshold) : item.threshold,
              lastUpdated: formatInventoryTimestamp(),
            }
          : item,
      ),
    );
  };

  const persistInventory = async (updater: (current: InventoryRow[]) => InventoryRow[]) => {
    setSyncStatus({ label: 'Saving inventory', state: 'saving' });
    setInventory((current) => {
      const nextInventory = updater(current);

      try {
        window.localStorage.setItem(inventoryStorageKey, JSON.stringify(nextInventory));
      } catch {
        // Ignore local storage errors and keep the UI responsive.
      }

      if (isSupabaseConfigured && supabase && process.env.REACT_APP_ADMIN_API_SECRET) {
        void fetch('/api/inventory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': process.env.REACT_APP_ADMIN_API_SECRET,
          },
          body: JSON.stringify({
            inventory: nextInventory.map((item) => ({
              id: item.id,
              product: item.product,
              stock: item.stock,
              threshold: item.threshold,
            })),
          }),
        }).catch(() => {
          // Fall back to local persistence.
        });
      }

      setSyncStatus({ label: 'Inventory saved', state: 'saved' });

      return nextInventory;
    });
  };

  const editStaff = (staffId: string) => {
    const staff = staffList.find((item) => item.id === staffId);
    if (!staff) return;
    setEditModal({
      kind: 'staff',
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    });
  };

  const saveEditModal = () => {
    if (!editModal) return;

    if (editModal.kind === 'product') {
      const price = Number(editModal.price);
      setSyncStatus({ label: 'Saving products', state: 'saving' });
      void persistProducts((current) =>
        current.map((product) =>
          product.id === editModal.id
            ? {
                ...product,
                name: editModal.name.trim() || product.name,
                description: editModal.description.trim() || product.description,
                category: editModal.category.trim() || product.category,
                price: Number.isFinite(price) ? price : product.price,
                featured: editModal.featured,
                is_available: editModal.is_available,
              }
            : product,
        ),
      );
    } else if (editModal.kind === 'category') {
      setSyncStatus({ label: 'Saving categories', state: 'saving' });
      setCategories((current) => {
        const nextCategories = current.map((category) =>
          category.id === editModal.id
            ? {
                ...category,
                name: editModal.name.trim() || category.name,
                parent: editModal.parent.trim() || undefined,
              }
            : category,
        );
        writeCategoryCache(nextCategories);
        emitCategorySync();
        setSyncStatus({ label: 'Categories saved', state: 'saved' });
        return nextCategories;
      });
    } else if (editModal.kind === 'staff') {
      setStaffList((current) =>
        current.map((staff) =>
          staff.id === editModal.id
            ? {
                ...staff,
                name: editModal.name.trim() || staff.name,
                email: editModal.email.trim() || staff.email,
                role: editModal.role,
              }
            : staff,
        ),
      );
    }

    setEditModal(null);
  };

  const deleteStaff = (staffId: string) => {
    setStaffList((current) => current.filter((staff) => staff.id !== staffId));
  };

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      const session = await getCurrentStaffSession();
      if (!mounted) return;
      setStaffSession(session);
    };
    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const db = supabase;

    const loadData = async () => {
      const ordersResponse = await db
        .from('orders')
        .select('id,customer_name,customer_phone,fulfillment,status,total,created_at,delivery_lat,delivery_lng')
        .order('created_at', { ascending: false })
        .limit(8);

      const productsResponse = await db
        .from('menu_items')
        .select('id,name,description,category,price,featured,is_available')
        .limit(12);

      const categoriesResponse = await db
        .from('categories')
        .select('id,name,parent')
        .order('name', { ascending: true })
        .limit(50);

      const profilesResponse = await db.from('profiles').select('id,full_name,email,role').limit(20);

      if (process.env.REACT_APP_ADMIN_API_SECRET) {
        try {
          const inventoryResponse = await fetch('/api/inventory', {
            headers: {
              'x-admin-secret': process.env.REACT_APP_ADMIN_API_SECRET,
            },
          });
          if (inventoryResponse.ok) {
            const inventoryPayload = await inventoryResponse.json();
            if (Array.isArray(inventoryPayload.items) && inventoryPayload.items.length) {
              const nextInventory = inventoryPayload.items.map((row: any) => ({
                id: String(row.id ?? row.item_name ?? createInventoryId()),
                product: String(row.item_name ?? row.product ?? 'Untitled'),
                stock: Number(row.stock ?? 0),
                threshold: Number(row.threshold ?? 0),
                lastUpdated: formatInventoryTimestamp(row.updated_at),
              }));
              setInventory(nextInventory);
              try {
                window.localStorage.setItem(inventoryStorageKey, JSON.stringify(nextInventory));
              } catch {
                // Ignore local storage errors.
              }
              setSyncStatus({ label: 'Inventory loaded', state: 'saved' });
            }
          }
        } catch {
          // Keep local inventory if the API is unavailable.
        }
      }

      if (!ordersResponse.error && ordersResponse.data?.length) {
        setOrders(
          ordersResponse.data.map((row: any) => ({
            id: String(row.id),
            customer_name: row.customer_name ?? 'Guest',
            customer_phone: row.customer_phone ?? 'n/a',
            fulfillment: row.fulfillment ?? 'pickup',
            status: row.status ?? 'new',
            total: Number(row.total ?? 0),
            created_at: String(row.created_at ?? new Date().toISOString()),
            delivery_lat: row.delivery_lat ?? null,
            delivery_lng: row.delivery_lng ?? null,
          })),
        );
      }

      if (!productsResponse.error && productsResponse.data?.length) {
        const remoteProducts = productsResponse.data.map((item: any) => ({
          id: String(item.id),
          name: item.name ?? 'Untitled',
          description: item.description ?? '',
          category: item.category ?? 'Uncategorized',
          price: Number(item.price ?? 0),
          featured: Boolean(item.featured),
          is_available: item.is_available ?? true,
        }));
        const cachedProducts = readMenuCache() ?? [];
        const nextProducts = mergeProductsById(cachedProducts, remoteProducts);
        setProducts(nextProducts);
        writeMenuCache(nextProducts);
        setSyncStatus({ label: 'Products loaded', state: 'saved' });
      }

      if (!categoriesResponse.error && categoriesResponse.data?.length) {
        const remoteCategories = (categoriesResponse.data as Array<{ id: string; name?: string | null; parent?: string | null }>).map((item) => ({
          id: String(item.id),
          name: item.name ?? 'Untitled Category',
          parent: item.parent ? String(item.parent) : undefined,
        }));
        const cachedCategories = readCategoryCache() ?? [];
        const nextCategories = mergeCategoriesById(cachedCategories, remoteCategories);
        setCategories(nextCategories);
        writeCategoryCache(nextCategories);
      }

      if (!profilesResponse.error && profilesResponse.data?.length) {
        const profileRows = profilesResponse.data as ProfileRow[];
        setStaffList(
          profileRows
            .filter((profile) => profile.role === 'admin' || profile.role === 'staff')
            .map((profile) => ({
              id: String(profile.id),
              name: profile.full_name ?? String(profile.email ?? 'Staff'),
              email: String(profile.email ?? ''),
              role: profile.role as StaffRole,
            })),
        );
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    writeCategoryCache(categories);
  }, [categories]);

  const submitLogin = async () => {
    setError('');
    const loginValue = loginForm.login.trim();
    const password = loginForm.password;

    if (!loginValue || !password) {
      setError('Username/email and password are required.');
      return;
    }

    setLoading(true);
    const result = await signIn(loginValue, password);
    setLoading(false);

    if (result.error || !result.session) {
      setError(result.error ?? 'Sign in failed.');
      return;
    }

    setStaffSession(result.session);
    setSelectedLoginRole(null);
    setActiveTab(result.session.role === 'staff' ? 'staff' : 'dashboard');
  };

  const handleLogout = async () => {
    await signOut();
    setStaffSession(null);
  };

  const openOrderModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setOrderModalOpen(false);
  };

  const renderStatusPill = (status: string) => (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-white/10 text-cream'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const visibleTabs = staffSession?.role === 'staff' ? staffTabs : tabs;
  const pageTitle = staffSession ? (staffSession.role === 'staff' ? 'Staff Console' : 'Admin Console') : 'Staff Login Dashboard';
  const pageDescription = staffSession
    ? staffSession.role === 'staff'
      ? 'See staff workflows, account access, and reporting in a focused panel.'
      : 'Manage orders, products, staff, inventory, and performance from one dashboard.'
    : 'Choose admin or staff access and sign in to the correct panel.';

  return (
    <div className="min-h-screen bg-[#0f0906] text-cream">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-xl shadow-black/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cream/45">{pageTitle === 'Staff Login Dashboard' ? 'Login Portal' : pageTitle}</p>
            <h1 className="mt-2 font-display text-4xl text-cream">{pageTitle === 'Staff Login Dashboard' ? 'Staff Login Dashboard' : 'Coffee Shop Admin Console'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-cream/70">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => (window.location.hash = '')}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream/70"
            >
              Back to storefront
            </button>
            {staffSession ? (
              <button type="button" onClick={handleLogout} className="rounded-full bg-gold px-4 py-2 font-semibold text-coffee-950">
                Sign out
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cream/70">
          <span>{syncStatus.label}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              syncStatus.state === 'saving'
                ? 'bg-amber-500/15 text-amber-200'
                : syncStatus.state === 'saved'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : syncStatus.state === 'error'
                    ? 'bg-red-500/15 text-red-200'
                    : 'bg-white/10 text-cream/60'
            }`}
          >
            {syncStatus.state === 'saving' ? 'Saving' : syncStatus.state === 'saved' ? 'Saved' : syncStatus.state === 'error' ? 'Sync error' : 'Idle'}
          </span>
        </div>

        <div className={`${staffSession ? 'grid gap-8 xl:grid-cols-[260px_1fr]' : 'space-y-6'}`}>
          {staffSession ? (
            <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4 text-sm text-cream/70">
                <p className="font-semibold text-cream">Signed in as</p>
                <p className="mt-2 text-base text-cream">{`${staffSession.name} • ${staffSession.role}`}</p>
                <p className="mt-1 text-sm text-cream/60">{staffSession.email}</p>
              </div>
              <nav className="space-y-2">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      activeTab === tab.id ? 'bg-gold/15 text-cream' : 'bg-black/20 text-cream/80 hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </aside>
          ) : null}

          <main className="space-y-6">
            {!staffSession ? (
              <AdminLoginPanel
                selectedLoginRole={selectedLoginRole}
                loginForm={loginForm}
                error={error}
                loading={loading}
                staffList={staffList}
                onRoleSelect={setSelectedLoginRole}
                onLoginFormChange={(field, value) => setLoginForm((current) => ({ ...current, [field]: value }))}
                onSubmit={() => void submitLogin()}
                onReset={() => {
                  setLoginForm({ login: '', password: '' });
                  setError('');
                }}
                onChooseOtherRole={() => {
                  setSelectedLoginRole(null);
                  setLoginForm({ login: '', password: '' });
                  setError('');
                }}
              />
            ) : (
              <>
                {activeTab === 'dashboard' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Overview</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Dashboard</h2>
                      </div>
                      <p className="max-w-xl text-sm text-cream/70">Quickly review today's orders, revenue, and pending tasks.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Today’s orders</p>
                        <p className="mt-3 text-4xl font-semibold text-cream">{overview.ordersToday}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Revenue</p>
                        <p className="mt-3 text-4xl font-semibold text-cream">{formatCurrency(overview.revenue)}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Pending tasks</p>
                        <p className="mt-3 text-4xl font-semibold text-cream">{overview.pending}</p>
                      </div>
                    </div>
                    <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Recent orders</p>
                          <h3 className="mt-2 text-xl font-semibold text-cream">Latest order activity</h3>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-cream/70">{orders.length} orders</span>
                      </div>
                      <div className="mt-5 space-y-4">
                        {orders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => openOrderModal(order)}
                            className="w-full rounded-3xl border border-white/10 bg-black/10 px-4 py-4 text-left transition hover:border-gold/30"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-cream/70">{order.customer_name} · {order.fulfillment}</p>
                                <p className="mt-1 text-lg font-semibold text-cream">{order.id}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {renderStatusPill(order.status)}
                                <span className="text-sm text-cream/60">{formatDate(order.created_at)}</span>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-cream/70">Total: {formatCurrency(order.total)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeTab === 'orders' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Orders</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Order management</h2>
                      </div>
                      <p className="max-w-xl text-sm text-cream/70">View recent orders, customer details, and status history in a read-only modal.</p>
                    </div>
                    <div className="grid gap-4">
                      {orders.map((order) => (
                        <div key={order.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-cream/70">{order.customer_name}</p>
                              <p className="mt-1 text-lg font-semibold text-cream">{order.id}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              {renderStatusPill(order.status)}
                              <span className="text-sm text-cream/60">{formatCurrency(order.total)}</span>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-cream/70">
                            <span>{order.fulfillment}</span>
                            <span>{formatDate(order.created_at)}</span>
                            <button type="button" onClick={() => openOrderModal(order)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream transition hover:border-gold/30">
                              View details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeTab === 'products' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Products/Services</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Catalog management</h2>
                      </div>
                      <button type="button" onClick={addProduct} className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add new product</button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map((product) => (
                        <div key={product.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-cream/70">{product.category}</p>
                              <h3 className="mt-2 text-xl font-semibold text-cream">{product.name}</h3>
                            </div>
                            <span className="text-lg font-semibold text-gold">{formatCurrency(product.price)}</span>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-cream/70">{product.description}</p>
                          <div className="mt-5 flex flex-wrap gap-2 text-sm">
                            <span className={`rounded-full border px-3 py-1 ${product.is_available ? 'border-emerald-500/20 text-emerald-200' : 'border-red-500/20 text-red-200'}`}>
                              {product.is_available ? 'Available' : 'Unavailable'}
                            </span>
                            {product.featured ? <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-cream/70">Featured</span> : null}
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" onClick={() => editProduct(product.id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream">Edit</button>
                            <button type="button" onClick={() => deleteProduct(product.id)} className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeTab === 'categories' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Categories</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Category management</h2>
                      </div>
                      <button type="button" onClick={addCategory} className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add category</button>
                    </div>
                    <div className="grid gap-4">
                      {categories.map((category) => (
                        <div key={category.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-cream/70">{category.parent ? `Subcategory of ${category.parent}` : 'Top-level category'}</p>
                              <h3 className="mt-1 text-xl font-semibold text-cream">{category.name}</h3>
                            </div>
                            <button type="button" onClick={() => editCategory(category.id)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream transition hover:border-gold/30">
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeTab === 'inventory' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Inventory</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Stock management</h2>
                      </div>
                      <button type="button" onClick={addStockLog} className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add stock log</button>
                    </div>
                    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/20">
                      <table className="min-w-full divide-y divide-white/10 text-left text-sm text-cream">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Stock</th>
                            <th className="px-4 py-3">Threshold</th>
                            <th className="px-4 py-3">Last updated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {inventory.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-4 text-cream">
                                <input
                                  value={item.product}
                                  onChange={(event) => updateInventoryItem(item.id, { product: event.target.value })}
                                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
                                  aria-label={`Edit name for ${item.product}`}
                                />
                              </td>
                              <td className="px-4 py-4 text-cream">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    aria-label={`Decrease stock for ${item.product}`}
                                    onClick={() => adjustInventoryStock(item.id, -1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-lg font-semibold text-cream transition hover:border-gold/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    disabled={item.stock <= 0}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={item.stock}
                                    onChange={(event) => {
                                      const nextValue = Number(event.target.value);
                                      updateInventoryItem(item.id, { stock: Number.isFinite(nextValue) ? nextValue : 0 });
                                    }}
                                    className="w-20 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center font-semibold text-cream outline-none transition focus:border-gold/60"
                                    aria-label={`Edit stock for ${item.product}`}
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Increase stock for ${item.product}`}
                                    onClick={() => adjustInventoryStock(item.id, 1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-lg font-semibold text-cream transition hover:border-gold/40 hover:bg-white/10"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-cream">{item.threshold}</td>
                              <td className="px-4 py-4 text-cream/70">{item.lastUpdated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {activeTab === 'staff' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Staff management</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Team accounts</h2>
                      </div>
                      {staffSession?.role === 'admin' ? (
                        <button type="button" onClick={() => setAddStaffOpen(true)} className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add staff</button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <p className="text-sm text-cream/70">{staff.role.toUpperCase()}</p>
                          <h3 className="mt-2 text-xl font-semibold text-cream">{staff.name}</h3>
                          <p className="mt-1 text-sm text-cream/70">{staff.email}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" onClick={() => editStaff(staff.id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream">Edit</button>
                            <button type="button" onClick={() => deleteStaff(staff.id)} className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {addStaffOpen ? (
                      <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
                        <h4 className="font-semibold text-cream">Create new staff account</h4>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <input className="rounded border p-2 bg-black/20 text-cream" placeholder="Full name" value={newStaff.name} onChange={(e) => setNewStaff((s) => ({ ...s, name: e.target.value }))} />
                          <input className="rounded border p-2 bg-black/20 text-cream" placeholder="Email" value={newStaff.email} onChange={(e) => setNewStaff((s) => ({ ...s, email: e.target.value }))} />
                          <select className="rounded border p-2 bg-black/20 text-cream" value={newStaff.role} onChange={(e) => setNewStaff((s) => ({ ...s, role: e.target.value as StaffRole }))}>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-gold px-4 py-2 font-semibold text-coffee-950"
                            onClick={async () => {
                              // create profile in Supabase if available, otherwise update local state
                              const entry: StaffRow = { id: `staff-${Date.now()}`, name: newStaff.name || newStaff.email, email: newStaff.email, role: newStaff.role };
                              if (isSupabaseConfigured) {
                                // Prefer a secure server-side endpoint that uses the Supabase service_role key.
                                try {
                                  const adminSecret = process.env.REACT_APP_ADMIN_API_SECRET;
                                  if (adminSecret) {
                                    const resp = await fetch('/api/create-staff', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'x-admin-secret': adminSecret,
                                      },
                                      body: JSON.stringify({ name: entry.name, email: entry.email, role: entry.role }),
                                    });
                                    if (resp.ok) {
                                      setStaffList((cur) => [entry, ...cur]);
                                    } else {
                                      // fallback to direct Supabase insert if serverless endpoint not available
                                      if (supabase) await supabase.from('profiles').insert({ full_name: entry.name, email: entry.email, role: entry.role });
                                      setStaffList((cur) => [entry, ...cur]);
                                    }
                                  } else if (supabase) {
                                    await supabase.from('profiles').insert({ full_name: entry.name, email: entry.email, role: entry.role });
                                    setStaffList((cur) => [entry, ...cur]);
                                  } else {
                                    setStaffList((cur) => [entry, ...cur]);
                                  }
                                } catch (e) {
                                  // fallback to local
                                  setStaffList((cur) => [entry, ...cur]);
                                }
                              } else {
                                setStaffList((cur) => [entry, ...cur]);
                              }
                              setNewStaff({ name: '', email: '', role: 'staff' });
                              setAddStaffOpen(false);
                            }}
                          >
                            Create
                          </button>
                          <button type="button" onClick={() => setAddStaffOpen(false)} className="rounded-full border border-white/10 px-4 py-2">Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {activeTab === 'reports' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Reports</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Revenue charts</h2>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-cream/70">
                        <button type="button" onClick={() => setReportRange('daily')} className={`rounded-full border px-4 py-2 ${reportRange === 'daily' ? 'border-gold bg-gold/15 text-cream' : 'border-white/10 bg-black/20 text-cream/70'}`}>Daily</button>
                        <button type="button" onClick={() => setReportRange('weekly')} className={`rounded-full border px-4 py-2 ${reportRange === 'weekly' ? 'border-gold bg-gold/15 text-cream' : 'border-white/10 bg-black/20 text-cream/70'}`}>Weekly</button>
                        <button type="button" onClick={() => setReportRange('monthly')} className={`rounded-full border px-4 py-2 ${reportRange === 'monthly' ? 'border-gold bg-gold/15 text-cream' : 'border-white/10 bg-black/20 text-cream/70'}`}>Monthly</button>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Top product</p>
                        <p className="mt-3 text-2xl font-semibold text-cream">Cappuccino</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Payment breakdown</p>
                        <p className="mt-3 text-2xl font-semibold text-cream">65% card</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-cream/70">Weekly growth</p>
                        <p className="mt-3 text-2xl font-semibold text-cream">+18%</p>
                      </div>
                    </div>
                    <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-5 text-sm text-cream/70">
                      Showing <span className="font-semibold text-cream capitalize">{reportRange}</span> report view.
                    </div>
                  </section>
                ) : null}

                {activeTab === 'reviews' ? (
                  <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Reviews</p>
                        <h2 className="mt-2 font-display text-3xl text-cream">Customer feedback</h2>
                      </div>
                      <div className="space-y-2 text-sm text-cream/70">
                        <p>Average rating</p>
                        <p className="text-3xl font-semibold text-cream">4.7 / 5</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sampleReviews.map((review) => (
                        <div key={review.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-cream/70">{review.product}</span>
                            <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">{review.rating}★</span>
                          </div>
                          <p className="mt-4 text-lg font-semibold text-cream">{review.customer}</p>
                          <p className="mt-2 text-sm leading-6 text-cream/70">{review.comment}</p>
                          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-cream/50">{review.date}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {editModal ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0f0906] p-6 shadow-2xl shadow-black/60">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Edit {editModal.kind}</p>
                          <h2 className="mt-2 font-display text-3xl text-cream">Update details</h2>
                        </div>
                        <button type="button" onClick={() => setEditModal(null)} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-cream/70">
                          Close
                        </button>
                      </div>

                      <div className="mt-6 space-y-4 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                        {editModal.kind === 'product' ? (
                          <>
                            <label className="block space-y-2 text-sm text-cream/70">
                              <span className="font-semibold text-cream">Name</span>
                              <input
                                value={editModal.name}
                                onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, name: event.target.value } : current))}
                                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                              />
                            </label>
                            <label className="block space-y-2 text-sm text-cream/70">
                              <span className="font-semibold text-cream">Description</span>
                              <textarea
                                value={editModal.description}
                                onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, description: event.target.value } : current))}
                                rows={3}
                                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                              />
                            </label>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block space-y-2 text-sm text-cream/70">
                                <span className="font-semibold text-cream">Category</span>
                                <input
                                  value={editModal.category}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, category: event.target.value } : current))}
                                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                                />
                              </label>
                              <label className="block space-y-2 text-sm text-cream/70">
                                <span className="font-semibold text-cream">Price</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={editModal.price}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, price: event.target.value } : current))}
                                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                                />
                              </label>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-cream/70">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editModal.featured}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, featured: event.target.checked } : current))}
                                />
                                Featured
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editModal.is_available}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'product' ? { ...current, is_available: event.target.checked } : current))}
                                />
                                Available
                              </label>
                            </div>
                          </>
                        ) : null}

                        {editModal.kind === 'category' ? (
                          <>
                            <label className="block space-y-2 text-sm text-cream/70">
                              <span className="font-semibold text-cream">Category name</span>
                              <input
                                value={editModal.name}
                                onChange={(event) => setEditModal((current) => (current && current.kind === 'category' ? { ...current, name: event.target.value } : current))}
                                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                              />
                            </label>
                            <label className="block space-y-2 text-sm text-cream/70">
                              <span className="font-semibold text-cream">Parent category</span>
                              <input
                                value={editModal.parent}
                                onChange={(event) => setEditModal((current) => (current && current.kind === 'category' ? { ...current, parent: event.target.value } : current))}
                                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                                placeholder="Optional"
                              />
                            </label>
                          </>
                        ) : null}

                        {editModal.kind === 'staff' ? (
                          <>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block space-y-2 text-sm text-cream/70">
                                <span className="font-semibold text-cream">Full name</span>
                                <input
                                  value={editModal.name}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'staff' ? { ...current, name: event.target.value } : current))}
                                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                                />
                              </label>
                              <label className="block space-y-2 text-sm text-cream/70">
                                <span className="font-semibold text-cream">Email</span>
                                <input
                                  value={editModal.email}
                                  onChange={(event) => setEditModal((current) => (current && current.kind === 'staff' ? { ...current, email: event.target.value } : current))}
                                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                                />
                              </label>
                            </div>
                            <label className="block space-y-2 text-sm text-cream/70">
                              <span className="font-semibold text-cream">Role</span>
                              <select
                                value={editModal.role}
                                onChange={(event) => setEditModal((current) => (current && current.kind === 'staff' ? { ...current, role: event.target.value as StaffRole } : current))}
                                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </label>
                          </>
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={saveEditModal} className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">
                            Save changes
                          </button>
                          <button type="button" onClick={() => setEditModal(null)} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-cream">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>

      {orderModalOpen && selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f0906] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Order detail</p>
                <h2 className="mt-2 font-display text-3xl text-cream">{selectedOrder.id}</h2>
              </div>
              <button type="button" onClick={closeOrderModal} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-cream/70">
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-cream/70">Customer info</p>
                <p className="mt-2 text-xl font-semibold text-cream">{selectedOrder.customer_name}</p>
                <p className="mt-1 text-sm text-cream/60">{selectedOrder.customer_phone}</p>
                <div className="mt-5 space-y-3 text-sm text-cream/70">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p>Status</p>
                    <div className="mt-2">{renderStatusPill(selectedOrder.status)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p>Fulfillment</p>
                    <p className="mt-2 text-cream">{selectedOrder.fulfillment}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p>Total</p>
                    <p className="mt-2 text-cream">{formatCurrency(selectedOrder.total)}</p>
                  </div>
                  {selectedOrder.delivery_lat != null && selectedOrder.delivery_lng != null ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <p>Delivery location</p>
                      <p className="mt-2 text-cream">{`lat: ${selectedOrder.delivery_lat.toFixed(5)}, lng: ${selectedOrder.delivery_lng.toFixed(5)}`}</p>
                      <p className="mt-2 text-sm text-cream/60">{
                        (() => {
                          const toRad = (deg: number) => (deg * Math.PI) / 180;
                          const R = 6371;
                          const dLat = toRad((selectedOrder.delivery_lat ?? 0) - 14.6498);
                          const dLon = toRad((selectedOrder.delivery_lng ?? 0) - 121.0509);
                          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(14.6498)) * Math.cos(toRad(selectedOrder.delivery_lat ?? 0)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                          const distKm = R * c;
                          return `${distKm.toFixed(1)} km from cafe`;
                        })()
                      }</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-cream/45">Status history</p>
                <div className="mt-4 space-y-4">
                  {orderTimeline(selectedOrder.status).map((step) => (
                    <div key={step.label} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm text-cream/70">
                        <span>{step.label}</span>
                        <span>{step.active ? 'Completed' : 'Pending'}</span>
                      </div>
                      <div className={`mt-2 h-2 rounded-full ${step.active ? 'bg-gold' : 'bg-white/10'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminDashboard;

