const { createClient } = require('@supabase/supabase-js');

// This serverless function expects an admin secret header to protect the endpoint.
// Set ADMIN_API_SECRET (or in CRA use REACT_APP_ADMIN_API_SECRET) in your deployment environment.

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminSecret = process.env.ADMIN_API_SECRET || process.env.REACT_APP_ADMIN_API_SECRET;
  const incoming = req.headers['x-admin-secret'] || req.headers['x-admin-token'];
  if (!adminSecret || !incoming || incoming !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const { name, email, role } = body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (!role || (role !== 'admin' && role !== 'staff')) return res.status(400).json({ error: 'Invalid role' });

  const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return res.status(500).json({ error: 'Supabase service role not configured on server' });

  const supabase = createClient(url, key);

  try {
    const insert = await supabase.from('profiles').insert({ full_name: name || email, email, role });
    if (insert.error) return res.status(500).json({ error: insert.error.message });
    return res.status(201).json({ success: true, data: insert.data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
