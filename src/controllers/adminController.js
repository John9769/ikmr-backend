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

    const totalUsers = await prisma.user.count();

    const motorCount = await prisma.subscription.count({
      where: { status: 'ACTIVE', shieldType: 'MOTOR' }
    });
    const medicalCount = await prisma.subscription.count({
      where: { status: 'ACTIVE', shieldType: 'MEDICAL' }
    });
    const bundleCount = await prisma.subscription.count({
      where: { status: 'ACTIVE', shieldType: 'BUNDLE' }
    });
    const totalActive = motorCount + medicalCount + bundleCount;

    const revenueMTD = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        activatedAt: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    const revenueYTD = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        activatedAt: { gte: startOfYear }
      },
      _sum: { amount: true }
    });

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expiringThisMonth = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: endOfMonth }
      }
    });

    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: {
            shieldType: true,
            activatedAt: true,
            expiresAt: true,
            amount: true
          }
        }
      }
    });

    res.json({
      stats: {
        totalUsers,
        totalActive,
        motorCount,
        medicalCount,
        bundleCount,
        revenueMTD: revenueMTD._sum.amount || 0,
        revenueYTD: revenueYTD._sum.amount || 0,
        expiringThisMonth
      },
      recentUsers
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET ALL USERS
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            shieldType: true,
            status: true,
            amount: true,
            activatedAt: true,
            expiresAt: true
          }
        }
      }
    });

    const total = await prisma.user.count();

    res.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET ALL SUBSCRIPTIONS
const getAllSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || undefined;

    const where = status ? { status } : {};

    const subscriptions = await prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    const total = await prisma.subscription.count({ where });

    res.json({
      subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
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
  getAllUsers,
  getAllSubscriptions,
  seedAdmin
};