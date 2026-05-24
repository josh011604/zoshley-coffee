const { createClient } = require('@supabase/supabase-js');

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
      const query = await supabase
        .from('menu_items')
        .select('id,name,description,category,price,featured,is_available,image_url,prep_time,updated_at')
        .order('featured', { ascending: false })
        .order('name', { ascending: true });

      if (query.error) return res.status(500).json({ error: query.error.message });
      return res.status(200).json({ items: query.data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const products = Array.isArray(body.products) ? body.products : null;
      if (!products) return res.status(400).json({ error: 'Missing products payload' });

      const rows = products
        .filter((item) => item && item.name)
        .map((item) => ({
          id: item.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
          name: String(item.name),
          description: String(item.description || ''),
          category: String(item.category || 'Uncategorized'),
          price: Number.isFinite(Number(item.price)) ? Math.max(0, Number(item.price)) : 0,
          featured: Boolean(item.featured),
          is_available: item.is_available ?? true,
          image_url: item.image_url ?? null,
          prep_time: item.prep_time ?? null,
        }));

      const ids = rows.map((row) => row.id);
      if (ids.length) {
        const remove = await supabase.from('menu_items').delete().not('id', 'in', `(${ids.join(',')})`);
        if (remove.error) return res.status(500).json({ error: remove.error.message });
      } else {
        const clear = await supabase.from('menu_items').delete().neq('id', '');
        if (clear.error) return res.status(500).json({ error: clear.error.message });
      }

      const upsert = await supabase
        .from('menu_items')
        .upsert(rows, { onConflict: 'id' })
        .select('id,name,description,category,price,featured,is_available,image_url,prep_time,updated_at')
        .order('featured', { ascending: false })
        .order('name', { ascending: true });

      if (upsert.error) return res.status(500).json({ error: upsert.error.message });
      return res.status(200).json({ items: upsert.data || [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};