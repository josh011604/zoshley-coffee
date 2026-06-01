const { createClient } = require('@supabase/supabase-js');
const { readFile, writeFile } = require('fs/promises');
const path = require('path');

const getSecret = () => process.env.ADMIN_API_SECRET || process.env.REACT_APP_ADMIN_API_SECRET;
const ordersStorePath = path.join(__dirname, 'orders-store.json');

const seedOrders = [
  {
    id: 'ORD-3241',
    customer_name: 'Anna Santos',
    customer_phone: '+63 917 123 4567',
    customer_email: null,
    fulfillment: 'pickup',
    notes: null,
    items: [],
    subtotal: 325,
    tax: 39,
    delivery_fee: 0,
    total: 364,
    status: 'new',
    created_at: '2026-05-24T10:18:00Z',
    updated_at: '2026-05-24T10:18:00Z',
    delivery_lat: null,
    delivery_lng: null,
  },
  {
    id: 'ORD-3240',
    customer_name: 'Miguel Cruz',
    customer_phone: '+63 917 987 6543',
    customer_email: null,
    fulfillment: 'delivery',
    notes: null,
    items: [],
    subtotal: 455,
    tax: 55,
    delivery_fee: 55,
    total: 565,
    status: 'preparing',
    created_at: '2026-05-24T09:58:00Z',
    updated_at: '2026-05-24T09:58:00Z',
    delivery_lat: null,
    delivery_lng: null,
  },
  {
    id: 'ORD-3239',
    customer_name: 'Bea Reyes',
    customer_phone: '+63 917 222 3344',
    customer_email: null,
    fulfillment: 'pickup',
    notes: null,
    items: [],
    subtotal: 215,
    tax: 26,
    delivery_fee: 0,
    total: 241,
    status: 'ready',
    created_at: '2026-05-24T09:12:00Z',
    updated_at: '2026-05-24T09:12:00Z',
    delivery_lat: null,
    delivery_lng: null,
  },
];

const readLocalOrders = async () => {
  try {
    const raw = await readFile(ordersStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Seed below.
  }

  await writeFile(ordersStorePath, JSON.stringify(seedOrders, null, 2), 'utf8');
  return seedOrders;
};

const writeLocalOrders = async (orders) => {
  await writeFile(ordersStorePath, JSON.stringify(orders, null, 2), 'utf8');
};

const getClient = () => {
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key);
};

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const demoStaffUsers = new Set([
  'jireh@zoshleycoffee.com|Jireh|admin',
  'rita@zoshleycoffee.com|Rita Bautista|admin',
  'maria@zoshley.com|Maria Santos|staff',
  'juan@zoshley.com|Juan dela Cruz|staff',
]);

const isValidDemoSession = (value) => {
  if (typeof value !== 'string' || !value) return false;
  try {
    const parsed = JSON.parse(value);
    const email = String(parsed.email || '').trim().toLowerCase();
    const name = String(parsed.name || '').trim();
    const role = String(parsed.role || '').trim();
    return demoStaffUsers.has(`${email}|${name}|${role}`);
  } catch {
    return false;
  }
};

const authorize = async (req, supabase) => {
  const adminSecret = getSecret();
  const incoming = req.headers['x-admin-secret'] || req.headers['x-admin-token'];
  if (adminSecret && incoming && incoming === adminSecret) return true;

  const demoSession = req.headers['x-demo-staff-session'];
  if (isValidDemoSession(demoSession)) return true;

  const token = getBearerToken(req);
  if (!token) return false;

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userResult?.user) return false;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userResult.user.id)
    .maybeSingle();

  if (profileError || !profile) return false;
  return profile.role === 'admin' || profile.role === 'staff';
};

const allowedStatuses = new Set(['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']);

const createLocalOrder = async (body) => {
  const orders = await readLocalOrders();
  const now = new Date().toISOString();
  const order = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ORD-${Date.now()}`,
    customer_name: String(body.customer_name || 'Guest'),
    customer_phone: String(body.customer_phone || 'n/a'),
    customer_email: body.customer_email ? String(body.customer_email) : null,
    fulfillment: body.fulfillment === 'delivery' ? 'delivery' : 'pickup',
    notes: body.notes ? String(body.notes) : null,
    items: Array.isArray(body.items) ? body.items : [],
    subtotal: Number.isFinite(Number(body.subtotal)) ? Number(body.subtotal) : 0,
    tax: Number.isFinite(Number(body.tax)) ? Number(body.tax) : 0,
    delivery_fee: Number.isFinite(Number(body.delivery_fee)) ? Number(body.delivery_fee) : 0,
    total: Number.isFinite(Number(body.total)) ? Number(body.total) : 0,
    status: 'new',
    created_at: now,
    updated_at: now,
    delivery_lat: body.delivery_lat ?? null,
    delivery_lng: body.delivery_lng ?? null,
  };

  const nextOrders = [order, ...orders];
  await writeLocalOrders(nextOrders);
  return order;
};

module.exports = async (req, res) => {
  const supabase = getClient();

  try {
    if (req.method === 'GET') {
      if (!supabase) {
        const items = await readLocalOrders();
        return res.status(200).json({ items });
      }

      const query = await supabase
        .from('orders')
        .select('id,customer_name,customer_phone,customer_email,fulfillment,notes,items,subtotal,tax,delivery_fee,total,status,created_at,updated_at,delivery_lat,delivery_lng')
        .order('created_at', { ascending: false })
        .limit(20);

      if (query.error) return res.status(500).json({ error: query.error.message });
      return res.status(200).json({ items: query.data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const orderId = String(body.orderId || body.order_id || body.id || '').trim();
      const status = String(body.status || '').trim();

      if (!orderId) {
        if (supabase) {
          const insert = await supabase
            .from('orders')
            .insert({
              customer_name: String(body.customer_name || 'Guest'),
              customer_phone: String(body.customer_phone || 'n/a'),
              customer_email: body.customer_email ? String(body.customer_email) : null,
              fulfillment: body.fulfillment === 'delivery' ? 'delivery' : 'pickup',
              notes: body.notes ? String(body.notes) : null,
              items: Array.isArray(body.items) ? body.items : [],
              subtotal: Number.isFinite(Number(body.subtotal)) ? Number(body.subtotal) : 0,
              tax: Number.isFinite(Number(body.tax)) ? Number(body.tax) : 0,
              delivery_fee: Number.isFinite(Number(body.delivery_fee)) ? Number(body.delivery_fee) : 0,
              total: Number.isFinite(Number(body.total)) ? Number(body.total) : 0,
              status: 'new',
              delivery_lat: body.delivery_lat ?? null,
              delivery_lng: body.delivery_lng ?? null,
            })
            .select('id,customer_name,customer_phone,customer_email,fulfillment,notes,items,subtotal,tax,delivery_fee,total,status,created_at,updated_at,delivery_lat,delivery_lng')
            .maybeSingle();

          if (insert.error) return res.status(500).json({ error: insert.error.message });
          if (!insert.data) return res.status(500).json({ error: 'Failed to create order' });

          return res.status(201).json({ item: insert.data });
        }

        const created = await createLocalOrder(body);
        return res.status(201).json({ item: created });
      }

      const allowed = supabase ? await authorize(req, supabase) : isValidDemoSession(req.headers['x-demo-staff-session']);
      if (!allowed) return res.status(401).json({ error: 'Unauthorized' });

      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      if (!allowedStatuses.has(status)) return res.status(400).json({ error: 'Invalid status' });

      if (!supabase) {
        const orders = await readLocalOrders();
        const nextOrders = orders.map((order) =>
          String(order.id) === orderId
            ? {
                ...order,
                status,
                updated_at: new Date().toISOString(),
              }
            : order,
        );
        const updated = nextOrders.find((order) => String(order.id) === orderId);
        if (!updated) return res.status(404).json({ error: 'Order not found' });

        await writeLocalOrders(nextOrders);
        return res.status(200).json({ item: updated });
      }

      const update = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select('id,customer_name,customer_phone,customer_email,fulfillment,notes,items,subtotal,tax,delivery_fee,total,status,created_at,updated_at,delivery_lat,delivery_lng')
        .maybeSingle();

      if (update.error) return res.status(500).json({ error: update.error.message });
      if (!update.data) return res.status(404).json({ error: 'Order not found' });

      return res.status(200).json({ item: update.data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};