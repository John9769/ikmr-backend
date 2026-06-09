const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const crypto = require('crypto');

const prisma = new PrismaClient();

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    const user = await prisma.user.create({
      data: { name, email, phone, password: hashedPassword }
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    await sendWelcomeEmail(user.email, user.name);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get parsed shields
    const shields = await prisma.parsedShield.findMany({
      where: { userId: user.id }
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      subscription: subscription || null,
      shields: shields || []
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If this email exists, a reset link has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetExpires
      }
    });

    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({ message: 'If this email exists, a reset link has been sent' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpires: null
      }
    });

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET PROFILE
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getProfile
};