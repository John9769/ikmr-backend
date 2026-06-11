const express = require('express');
const router = express.Router();
const {
  createBill,
  webhook,
  checkPaymentStatus
} = require('../controllers/paymentController');

router.post('/create-bill', createBill);
router.post('/webhook', webhook);
router.get('/status/:parseRequestId', checkPaymentStatus);

module.exports = router;