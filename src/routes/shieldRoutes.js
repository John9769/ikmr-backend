const express = require('express');
const router = express.Router();
const {
  getCrisisScreen,
  getShieldsStatus
} = require('../controllers/shieldController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/crisis-screen', authMiddleware, getCrisisScreen);
router.get('/status', authMiddleware, getShieldsStatus);

module.exports = router;