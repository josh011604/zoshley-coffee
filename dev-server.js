const express = require('express');
const fs = require('fs');

function createLocalOrderFromBody(req) {
  const order = req.body;
  if (!order.orderId && !order.id) {
    order.orderId = `order_${Date.now()}`;
  }
  return order;
}

const bodyParser = require('body-parser');
const createStaffHandler = require('./api/create-staff');
const inventoryHandler = require('./api/inventory');
const ordersHandler = require('./api/orders');
const menuItemsHandler = require('./api/menu-items');

const app = express();

app.post('/api/orders', express.json(), (req, res, next) => {
  if (process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL) {
    return next();
  }

  const path = require('path');
  const ordersFile = path.join(__dirname, 'api', 'orders-store.json');
  const existing = fs.existsSync(ordersFile)
    ? JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]')
    : [];

  const body = req.body || {};
  const newOrder = {
    id: `ORD-${Date.now()}`,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    delivery_lat: body.delivery_lat ?? null,
    delivery_lng: body.delivery_lng ?? null,
  };

  existing.unshift(newOrder);
  fs.writeFileSync(ordersFile, JSON.stringify(existing, null, 2));
  res.status(201).json({ item: newOrder });
});
app.use(bodyParser.json());

app.post('/api/create-staff', (req, res) => {
  // Forward to the existing handler
  return createStaffHandler(req, res);
});

app.all('/api/inventory', (req, res) => {
  return inventoryHandler(req, res);
});

app.all('/api/orders', (req, res) => {
  return ordersHandler(req, res);
});

app.all('/api/menu-items', (req, res) => {
  return menuItemsHandler(req, res);
});

const port = process.env.DEV_API_PORT || 4000;
app.listen(port, () => console.log(`Dev API server listening on http://localhost:${port}`));
