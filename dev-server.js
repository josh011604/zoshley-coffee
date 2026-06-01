const express = require('express');
const bodyParser = require('body-parser');
const createStaffHandler = require('./api/create-staff');
const inventoryHandler = require('./api/inventory');
const ordersHandler = require('./api/orders');
const menuItemsHandler = require('./api/menu-items');

const app = express();
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
