const express = require('express');
const router = express.Router();
const {
  registerAgent,
  getAgentStats,
  validateAgentCode
} = require('../controllers/agentController');

router.post('/register', registerAgent);
router.get('/stats/:agentCode', getAgentStats);
router.get('/validate/:agentCode', validateAgentCode);

module.exports = router;