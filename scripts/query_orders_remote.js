const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const file = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (!m) return acc;
    let val = m[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    acc[m[1]] = val;
    return acc;
  }, {});
}

async function main() {
  const env = loadEnvLocal();
  const url = env.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Supabase env vars not found in .env.local or process.env');
    process.exit(2);
  }

  const supabase = createClient(url, key);

  try {
    const { data, error, status } = await supabase.from('orders').select('id,customer_name,status,total,created_at').order('created_at', { ascending: false }).limit(10);
    if (error) {
      console.error('Query error:', error);
      process.exit(3);
    }
    console.log('Query status:', status);
    console.log('Orders:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Unexpected error', e);
  }
}

main();
