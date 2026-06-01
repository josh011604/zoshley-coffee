const { createClient } = require('@supabase/supabase-js');

const getSecret = () => process.env.ADMIN_API_SECRET || process.env.REACT_APP_ADMIN_API_SECRET;

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

const authorize = async (req, supabase) => {
  const adminSecret = getSecret();
  const incoming = req.headers['x-admin-secret'] || req.headers['x-admin-token'];
  if (adminSecret && incoming && incoming === adminSecret) return true;

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

module.exports = async (req, res) => {
  const supabase = getClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role not configured on server' });
  }

  try {
    if (req.method === 'GET') {
      const query = await supabase
        .from('orders')
        .select('id,customer_name,customer_phone,customer_email,fulfillment,notes,items,subtotal,tax,delivery_fee,total,status,created_at,updated_at,delivery_lat,delivery_lng')
        .order('created_at', { ascending: false })
        .limit(20);

      if (query.error) return res.status(500).json({ error: query.error.message });
      return res.status(200).json({ items: query.data || [] });
    }

    if (req.method === 'POST') {
      const allowed = await authorize(req, supabase);
      if (!allowed) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body || {};
      const orderId = String(body.orderId || body.order_id || body.id || '').trim();
      const status = String(body.status || '').trim();

      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      if (!allowedStatuses.has(status)) return res.status(400).json({ error: 'Invalid status' });

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