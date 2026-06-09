const express = require('express');
const router = express.Router();
const {
  createBill,
  webhook,
  getSubscriptionStatus,
  upgradeToBunde
} = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-bill', authMiddleware, createBill);
router.post('/webhook', webhook);
router.get('/subscription', authMiddleware, getSubscriptionStatus);
router.post('/upgrade', authMiddleware, upgradeToBunde);

module.exports = router;