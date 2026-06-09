const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { sendSubscriptionActivatedEmail } = require('../utils/emailService');

const prisma = new PrismaClient();

const TOYYIBPAY_SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY;
const TOYYIBPAY_BASE_URL = process.env.TOYYIBPAY_BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

const SHIELD_CONFIG = {
  MOTOR: {
    categoryCode: process.env.TOYYIBPAY_CATEGORY_MOTOR,
    amount: 2400,
    label: 'IKMR Motor Shield'
  },
  MEDICAL: {
    categoryCode: process.env.TOYYIBPAY_CATEGORY_MEDICAL,
    amount: 2400,
    label: 'IKMR Medical Shield'
  },
  BUNDLE: {
    categoryCode: process.env.TOYYIBPAY_CATEGORY_BUNDLE,
    amount: 4400,
    label: 'IKMR Bundle Shield'
  }
};

// CREATE BILL
const createBill = async (req, res) => {
  try {
    const { shieldType } = req.body;
    const userId = req.userId;

    if (!['MOTOR', 'MEDICAL', 'BUNDLE'].includes(shieldType)) {
      return res.status(400).json({ message: 'Invalid shield type' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check existing active subscription
    const existingSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' }
    });
    if (existingSub) {
      return res.status(400).json({ message: 'You already have an active subscription' });
    }

    const config = SHIELD_CONFIG[shieldType];

    // Create pending subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        shieldType,
        status: 'PENDING',
        amount: config.amount / 100
      }
    });

    // Create ToyyibPay bill
    const billData = new URLSearchParams();
    billData.append('userSecretKey', TOYYIBPAY_SECRET_KEY);
    billData.append('categoryCode', config.categoryCode);
    billData.append('billName', config.label);
    billData.append('billDescription', `${config.label} - Annual Subscription`);
    billData.append('billPriceSetting', 1);
    billData.append('billPayorInfo', 1);
    billData.append('billAmount', config.amount);
    billData.append('billReturnUrl', `${FRONTEND_URL}/payment/success`);
    billData.append('billCallbackUrl', `${process.env.BACKEND_URL}/api/payment/webhook`);
    billData.append('billExternalReferenceNo', subscription.id);
    billData.append('billTo', user.name);
    billData.append('billEmail', user.email);
    billData.append('billPhone', user.phone);
    billData.append('billSplitPayment', 0);
    billData.append('billSplitPaymentArgs', '');
    billData.append('billPaymentChannel', 0);
    billData.append('billDisplayMerchant', 1);
    billData.append('billContentEmail', `Thank you for subscribing to ${config.label}`);
    billData.append('billChargeToCustomer', 1);

    const response = await axios.post(
      `${TOYYIBPAY_BASE_URL}/index.php/api/createBill`,
      billData.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const billCode = response.data[0]?.BillCode;
    if (!billCode) {
      return res.status(500).json({ message: 'Failed to create payment bill' });
    }

    // Save bill code
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { billCode }
    });

    res.json({
      billCode,
      paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}`
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// WEBHOOK
const webhook = async (req, res) => {
  try {
    const {
      refno,
      status,
      billcode,
      order_id
    } = req.body;

    // status 1 = success
    if (status !== '1') {
      return res.status(200).send('OK');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: order_id },
      include: { user: true }
    });

    if (!subscription) {
      return res.status(200).send('OK');
    }

    if (subscription.status === 'ACTIVE') {
      return res.status(200).send('OK');
    }

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        paymentRef: refno,
        activatedAt,
        expiresAt
      }
    });

    await sendSubscriptionActivatedEmail(
      subscription.user.email,
      subscription.user.name,
      subscription.shieldType,
      expiresAt
    );

    console.log(`Subscription activated for ${subscription.user.email}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK');
  }
};

// GET SUBSCRIPTION STATUS
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.userId;

    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ subscription: subscription || null });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPGRADE TO BUNDLE
const upgradeToBunde = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' }
    });

    if (!existingSub) {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    if (existingSub.shieldType === 'BUNDLE') {
      return res.status(400).json({ message: 'Already on Bundle Shield' });
    }

    const config = SHIELD_CONFIG['BUNDLE'];

    // Create pending upgrade subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        shieldType: 'BUNDLE',
        status: 'PENDING',
        amount: config.amount / 100
      }
    });

    const billData = new URLSearchParams();
    billData.append('userSecretKey', TOYYIBPAY_SECRET_KEY);
    billData.append('categoryCode', config.categoryCode);
    billData.append('billName', 'IKMR Upgrade to Bundle Shield');
    billData.append('billDescription', 'Upgrade to Motor + Medical Bundle Shield');
    billData.append('billPriceSetting', 1);
    billData.append('billPayorInfo', 1);
    billData.append('billAmount', config.amount);
    billData.append('billReturnUrl', `${FRONTEND_URL}/payment/success`);
    billData.append('billCallbackUrl', `${process.env.BACKEND_URL}/api/payment/webhook`);
    billData.append('billExternalReferenceNo', subscription.id);
    billData.append('billTo', user.name);
    billData.append('billEmail', user.email);
    billData.append('billPhone', user.phone);
    billData.append('billSplitPayment', 0);
    billData.append('billSplitPaymentArgs', '');
    billData.append('billPaymentChannel', 0);
    billData.append('billDisplayMerchant', 1);
    billData.append('billContentEmail', 'Thank you for upgrading to Bundle Shield');
    billData.append('billChargeToCustomer', 1);

    const response = await axios.post(
      `${TOYYIBPAY_BASE_URL}/index.php/api/createBill`,
      billData.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const billCode = response.data[0]?.BillCode;
    if (!billCode) {
      return res.status(500).json({ message: 'Failed to create payment bill' });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { billCode }
    });

    res.json({
      billCode,
      paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}`
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createBill,
  webhook,
  getSubscriptionStatus,
  upgradeToBunde
};