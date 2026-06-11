const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendAgentWelcomeEmail } = require('../utils/emailService');

const prisma = new PrismaClient();

// Generate unique agent code
const generateAgentCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;
  while (exists) {
    code = 'AGT';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.agent.findUnique({ where: { agentCode: code } });
    exists = !!existing;
  }
  return code;
};

// REGISTER AGENT
const registerAgent = async (req, res) => {
  try {
    const { name, email, phone, bankName, bankAccount } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Name, email and phone required' });
    }

    const existing = await prisma.agent.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered as agent' });
    }

    const agentCode = await generateAgentCode();

    const agent = await prisma.agent.create({
      data: {
        name,
        email,
        phone,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        agentCode,
        isActive: true
      }
    });

    await sendAgentWelcomeEmail(agent.email, agent.name, agent.agentCode);

    res.status(201).json({
      message: 'Agent registered successfully',
      agentCode: agent.agentCode,
      name: agent.name,
      email: agent.email
    });

  } catch (error) {
    console.error('Register agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET AGENT STATS
const getAgentStats = async (req, res) => {
  try {
    const { agentCode } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { agentCode },
      include: {
        parseRequests: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        payouts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const totalParses = agent.parseRequests.filter(
      r => r.status === 'PARSED' || r.status === 'PAID'
    ).length;

    res.json({
      agent: {
        name: agent.name,
        email: agent.email,
        agentCode: agent.agentCode,
        pendingBalance: agent.pendingBalance,
        totalEarned: agent.totalEarned,
        isActive: agent.isActive,
        createdAt: agent.createdAt
      },
      totalParses,
      recentRequests: agent.parseRequests,
      payouts: agent.payouts
    });

  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// VALIDATE AGENT CODE
const validateAgentCode = async (req, res) => {
  try {
    const { agentCode } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { agentCode },
      select: {
        name: true,
        agentCode: true,
        isActive: true
      }
    });

    if (!agent || !agent.isActive) {
      return res.status(404).json({ valid: false, message: 'Invalid agent code' });
    }

    res.json({
      valid: true,
      agentName: agent.name,
      agentCode: agent.agentCode
    });

  } catch (error) {
    console.error('Validate agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerAgent,
  getAgentStats,
  validateAgentCode
};