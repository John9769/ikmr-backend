const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// ADMIN LOGIN
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Admin login successful', token });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ADMIN AUTH MIDDLEWARE
const adminAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// GET DASHBOARD STATS
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Total parses
    const totalParses = await prisma.parseRequest.count({
      where: { status: 'PARSED' }
    });

    // Motor vs Medical
    const motorCount = await prisma.parseRequest.count({
      where: { status: 'PARSED', shieldType: 'MOTOR' }
    });

    const medicalCount = await prisma.parseRequest.count({
      where: { status: 'PARSED', shieldType: 'MEDICAL' }
    });

    // Revenue MTD
    const revenueMTDData = await prisma.parseRequest.count({
      where: {
        status: 'PARSED',
        createdAt: { gte: startOfMonth }
      }
    });
    const revenueMTD = revenueMTDData * 14.99;

    // Revenue YTD
    const revenueYTDData = await prisma.parseRequest.count({
      where: {
        status: 'PARSED',
        createdAt: { gte: startOfYear }
      }
    });
    const revenueYTD = revenueYTDData * 14.99;

    // Agent stats
    const totalAgents = await prisma.agent.count({
      where: { isActive: true }
    });

    const pendingAgents = await prisma.agent.count({
      where: { isActive: false }
    });

    const agentParses = await prisma.parseRequest.count({
      where: {
        status: 'PARSED',
        agentCode: { not: null }
      }
    });

    const totalAgentCommissions = await prisma.agent.aggregate({
      _sum: { totalEarned: true }
    });

    // Pending payouts
    const pendingPayouts = await prisma.agent.aggregate({
      where: { pendingBalance: { gt: 0 } },
      _sum: { pendingBalance: true }
    });

    // Recent parse requests
    const recentParses = await prisma.parseRequest.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      stats: {
        totalParses,
        motorCount,
        medicalCount,
        revenueMTD: revenueMTD.toFixed(2),
        revenueYTD: revenueYTD.toFixed(2),
        totalAgents,
        pendingAgents,
        agentParses,
        directParses: totalParses - agentParses,
        totalAgentCommissions: totalAgentCommissions._sum.totalEarned || 0,
        pendingPayouts: pendingPayouts._sum.pendingBalance || 0
      },
      recentParses
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET ALL PARSE REQUESTS
const getAllParseRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || undefined;
    const shieldType = req.query.shieldType || undefined;

    const where = {};
    if (status) where.status = status;
    if (shieldType) where.shieldType = shieldType;

    const parses = await prisma.parseRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.parseRequest.count({ where });

    res.json({
      parses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get parse requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET ALL AGENTS
const getAllAgents = async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { parseRequests: true }
        }
      }
    });

    res.json({ agents });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// APPROVE AGENT
const approveAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.isActive) {
      return res.status(400).json({ message: 'Agent already active' });
    }

    await prisma.agent.update({
      where: { id: agentId },
      data: { isActive: true }
    });

    res.json({ message: `Agent ${agent.name} (${agent.agentCode}) approved` });

  } catch (error) {
    console.error('Approve agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// REJECT AGENT
const rejectAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    await prisma.agent.delete({
      where: { id: agentId }
    });

    res.json({ message: `Agent ${agent.name} rejected and removed` });

  } catch (error) {
    console.error('Reject agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// MARK AGENT PAYOUT DONE
const markPayoutDone = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const amount = agent.pendingBalance;

    if (amount <= 0) {
      return res.status(400).json({ message: 'No pending balance' });
    }

    // Create payout record
    await prisma.payout.create({
      data: {
        agentId,
        amount,
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // Reset pending balance
    await prisma.agent.update({
      where: { id: agentId },
      data: { pendingBalance: 0 }
    });

    res.json({
      message: `Payout of RM${amount.toFixed(2)} marked as done for ${agent.name}`
    });

  } catch (error) {
    console.error('Mark payout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// SEED ADMIN
const seedAdmin = async (req, res) => {
  try {
    const existing = await prisma.admin.findUnique({
      where: { email: process.env.ADMIN_EMAIL }
    });

    if (existing) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await prisma.admin.create({
      data: {
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword
      }
    });

    res.json({ message: 'Admin seeded successfully' });

  } catch (error) {
    console.error('Seed admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  adminLogin,
  adminAuthMiddleware,
  getDashboardStats,
  getAllParseRequests,
  getAllAgents,
  approveAgent,
  rejectAgent,
  markPayoutDone,
  seedAdmin
};