const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const parserRoutes = require('./routes/parserRoutes');
const shieldRoutes = require('./routes/shieldRoutes');
const adminRoutes = require('./routes/adminRoutes');

const { startCronJobs } = require('./utils/cronJobs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/parser', parserRoutes);
app.use('/api/shield', shieldRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'IKMR Backend Running', version: '1.0.0' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`IKMR Backend running on port ${PORT}`);
  startCronJobs();
});

module.exports = app;