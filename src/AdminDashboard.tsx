import React, { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { signIn, signOut, getCurrentStaffSession, StaffSession as AuthStaffSession } from './lib/auth';
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

type ReviewRow = {
  id: string;
  customer: string;
  product: string;
  rating: number;
  comment: string;
  date: string;
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
  { product: 'Espresso Beans', stock: 12, threshold: 8, lastUpdated: '2026-05-24 08:20' },
  { product: 'Milk', stock: 18, threshold: 12, lastUpdated: '2026-05-24 07:50' },
  { product: 'Butter Croissant', stock: 5, threshold: 6, lastUpdated: '2026-05-24 09:15' },
];

const sampleStaff: StaffRow[] = [
  { id: 'staff-1', name: 'Rita Bautista', email: 'rita@zoshleycoffee.com', role: 'admin' },
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

const AdminDashboard: React.FC = () => {
  const [staffSession, setStaffSession] = useState<AuthStaffSession | null>(null);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [selectedLoginRole, setSelectedLoginRole] = useState<StaffRole | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [orders, setOrders] = useState<OrderRow[]>(sampleOrders);
  const [products, setProducts] = useState<MenuItem[]>(sampleProducts);
  const [categories] = useState<CategoryRow[]>(sampleCategories);
  const [inventory] = useState<InventoryRow[]>(sampleInventory);
  const [staffList, setStaffList] = useState<StaffRow[]>(sampleStaff);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  const overview = useMemo(
    () => ({
      ordersToday: orders.filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString()).length,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      pending: orders.filter((order) => ['new', 'confirmed', 'preparing'].includes(order.status)).length,
    }),
    [orders],
  );

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
      const [ordersResult, productsResult, profilesResult] = await Promise.all([
        db.from('orders').select('id,customer_name,customer_phone,fulfillment,status,total,created_at,delivery_lat,delivery_lng').order('created_at', { ascending: false }).limit(8),
        db.from('menu_items').select('id,name,description,category,price,featured,is_available').limit(12),
        db.from('profiles').select('id,full_name,email,role').limit(20),
      ]);

      if (!ordersResult.error && ordersResult.data?.length) {
        setOrders(
          ordersResult.data.map((row: any) => ({
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

      if (!productsResult.error && productsResult.data?.length) {
        setProducts(
          productsResult.data.map((item) => ({
            id: String(item.id),
            name: item.name ?? 'Untitled',
            description: item.description ?? '',
            category: item.category ?? 'Uncategorized',
            price: Number(item.price ?? 0),
            featured: Boolean(item.featured),
            is_available: item.is_available ?? true,
          })),
        );
      }

      if (!profilesResult.error && profilesResult.data?.length) {
        setStaffList(
          profilesResult.data
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
                      <button type="button" className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add new product</button>
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
                            <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream">Edit</button>
                            <button type="button" className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream">Delete</button>
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
                      <button type="button" className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add category</button>
                    </div>
                    <div className="grid gap-4">
                      {categories.map((category) => (
                        <div key={category.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-cream/70">{category.parent ? `Subcategory of ${category.parent}` : 'Top-level category'}</p>
                              <h3 className="mt-1 text-xl font-semibold text-cream">{category.name}</h3>
                            </div>
                            <button type="button" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cream transition hover:border-gold/30">
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
                      <button type="button" className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add stock log</button>
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
                            <tr key={item.product}>
                              <td className="px-4 py-4 text-cream">{item.product}</td>
                              <td className="px-4 py-4 text-cream">{item.stock}</td>
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
                      <button type="button" className="rounded-full bg-gold px-4 py-3 font-semibold text-coffee-950">Add staff</button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <p className="text-sm text-cream/70">{staff.role.toUpperCase()}</p>
                          <h3 className="mt-2 text-xl font-semibold text-cream">{staff.name}</h3>
                          <p className="mt-1 text-sm text-cream/70">{staff.email}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream">Edit</button>
                            <button type="button" className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
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
                        <button type="button" className="rounded-full border border-white/10 bg-black/20 px-4 py-2">Daily</button>
                        <button type="button" className="rounded-full border border-white/10 bg-black/20 px-4 py-2">Weekly</button>
                        <button type="button" className="rounded-full border border-white/10 bg-black/20 px-4 py-2">Monthly</button>
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

