const express = require('express');
const router = express.Router();
const {
  adminLogin,
  adminAuthMiddleware,
  getDashboardStats,
  getAllParseRequests,
  getAllAgents,
  markPayoutDone,
  seedAdmin
} = require('../controllers/adminController');

router.post('/login', adminLogin);
router.get('/seed', seedAdmin);
router.get('/stats', adminAuthMiddleware, getDashboardStats);
router.get('/parses', adminAuthMiddleware, getAllParseRequests);
router.get('/agents', adminAuthMiddleware, getAllAgents);
router.post('/payout/:agentId', adminAuthMiddleware, markPayoutDone);

module.exports = router;