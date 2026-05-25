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

module.exports = async (req, res) => {
  const supabase = getClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role not configured on server' });
  }

  try {
    if (req.method === 'GET') {
      const query = await supabase.from('categories').select('id,name,parent,created_at,updated_at').order('name', { ascending: true });
      if (query.error) return res.status(500).json({ error: query.error.message });
      return res.status(200).json({ items: query.data || [] });
    }

    if (req.method === 'POST') {
      const allowed = await authorize(req, supabase);
      if (!allowed) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body || {};
      const categories = Array.isArray(body.categories) ? body.categories : null;
      if (!categories) return res.status(400).json({ error: 'Missing categories payload' });

      const rows = categories
        .filter((item) => item && item.name)
        .map((item) => ({
          id: item.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
          name: String(item.name),
          parent: item.parent ? String(item.parent) : null,
        }));

      const ids = rows.map((row) => row.id);
      if (ids.length) {
        const remove = await supabase.from('categories').delete().not('id', 'in', `(${ids.join(',')})`);
        if (remove.error) return res.status(500).json({ error: remove.error.message });
      } else {
        const clear = await supabase.from('categories').delete().neq('id', '');
        if (clear.error) return res.status(500).json({ error: clear.error.message });
      }

      const upsert = await supabase
        .from('categories')
        .upsert(rows, { onConflict: 'id' })
        .select('id,name,parent,created_at,updated_at')
        .order('name', { ascending: true });

      if (upsert.error) return res.status(500).json({ error: upsert.error.message });
      return res.status(200).json({ items: upsert.data || [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};