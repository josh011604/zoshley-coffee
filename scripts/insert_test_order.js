const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const file = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
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

  const payload = {
    customer_name: 'Script Test',
    customer_phone: '09170000000',
    fulfillment: 'pickup',
    items: [{ id: 'test-1', name: 'Test', price: 1, quantity: 1 }],
    subtotal: 1,
    tax: 0,
    delivery_fee: 0,
    total: 1,
    status: 'new',
  };

  try {
    const res = await supabase.from('orders').insert(payload);
    console.log('Insert result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Insert error', e);
  }
}

main();
