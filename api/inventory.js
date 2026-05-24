const { createClient } = require('@supabase/supabase-js');

const defaultInventory = [
  { item_name: 'Espresso Beans', stock: 12, threshold: 8 },
  { item_name: 'Milk', stock: 18, threshold: 12 },
  { item_name: 'Butter Croissant', stock: 5, threshold: 6 },
];

const getSecret = () => process.env.ADMIN_API_SECRET || process.env.REACT_APP_ADMIN_API_SECRET;

const getClient = () => {
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key);
};

module.exports = async (req, res) => {
  const adminSecret = getSecret();
  const incoming = req.headers['x-admin-secret'] || req.headers['x-admin-token'];
  if (!adminSecret || !incoming || incoming !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role not configured on server' });
  }

  try {
    if (req.method === 'GET') {
      const query = await supabase.from('inventory_items').select('id,item_name,stock,threshold,updated_at').order('item_name', { ascending: true });
      if (query.error) return res.status(500).json({ error: query.error.message });

      if (!query.data || query.data.length === 0) {
        const seed = await supabase.from('inventory_items').upsert(defaultInventory, { onConflict: 'item_name' }).select('id,item_name,stock,threshold,updated_at').order('item_name', { ascending: true });
        if (seed.error) return res.status(500).json({ error: seed.error.message });
        return res.status(200).json({ items: seed.data || [] });
      }

      return res.status(200).json({ items: query.data });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const inventory = Array.isArray(body.inventory) ? body.inventory : null;
      if (!inventory) return res.status(400).json({ error: 'Missing inventory payload' });

      const rows = inventory
        .filter((item) => item && item.product)
        .map((item) => ({
          id: item.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
          item_name: String(item.product),
          stock: Number.isFinite(Number(item.stock)) ? Math.max(0, Number(item.stock)) : 0,
          threshold: Number.isFinite(Number(item.threshold)) ? Math.max(0, Number(item.threshold)) : 0,
        }));

      const upsert = await supabase.from('inventory_items').upsert(rows, { onConflict: 'id' }).select('id,item_name,stock,threshold,updated_at').order('item_name', { ascending: true });
      if (upsert.error) return res.status(500).json({ error: upsert.error.message });
      return res.status(200).json({ items: upsert.data || [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};