const express = require('express');
const bodyParser = require('body-parser');
const createStaffHandler = require('./api/create-staff');

const app = express();
app.use(bodyParser.json());

app.post('/api/create-staff', (req, res) => {
  // Forward to the existing handler
  return createStaffHandler(req, res);
});

const port = process.env.DEV_API_PORT || 4000;
app.listen(port, () => console.log(`Dev API server listening on http://localhost:${port}`));
