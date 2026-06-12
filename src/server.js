const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const paymentRoutes = require('./routes/paymentRoutes');
const parserRoutes = require('./routes/parserRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');

const app = express();

app.use(cors());

// ToyyibPay webhook fix: their callback doesn't always send a proper
// Content-Type header, so express.urlencoded() silently returns {}.
// Intercept this specific route BEFORE the general body parsers and
// parse the raw bytes as x-www-form-urlencoded manually.
app.use('/api/payment/webhook', express.raw({ type: '*/*' }), (req, res, next) => {
  try {
    const raw = req.body.toString('utf8');
    req.body = Object.fromEntries(new URLSearchParams(raw));
  } catch (e) {
    req.body = {};
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/payment', paymentRoutes);
app.use('/api/parser', parserRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'IKMR Backend Running', version: '2.0.0' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`IKMR Backend running on port ${PORT}`);
});

module.exports = app;