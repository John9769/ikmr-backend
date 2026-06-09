const express = require('express');
const router = express.Router();
const {
  adminLogin,
  adminAuthMiddleware,
  getDashboardStats,
  getAllUsers,
  getAllSubscriptions,
  seedAdmin
} = require('../controllers/adminController');

router.post('/login', adminLogin);
router.get('/seed', seedAdmin);
router.get('/stats', adminAuthMiddleware, getDashboardStats);
router.get('/users', adminAuthMiddleware, getAllUsers);
router.get('/subscriptions', adminAuthMiddleware, getAllSubscriptions);

module.exports = router;