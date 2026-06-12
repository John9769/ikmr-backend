const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { sendPaymentConfirmationEmail } = require('../utils/emailService');

const prisma = new PrismaClient();

const TOYYIBPAY_SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY;
const TOYYIBPAY_BASE_URL = process.env.TOYYIBPAY_BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

const SHIELD_CONFIG = {
  MOTOR: {
    categoryCode: process.env.TOYYIBPAY_CATEGORY_MOTOR,
    amount: 1499,
    label: 'IKMR Motor Rights Audit'
  },
  MEDICAL: {
    categoryCode: process.env.TOYYIBPAY_CATEGORY_MEDICAL,
    amount: 1499,
    label: 'IKMR Medical Rights Audit'
  }
};

// CREATE BILL
const createBill = async (req, res) => {
  try {
    const { shieldType, email, phone, agentCode } = req.body;

    if (!['MOTOR', 'MEDICAL'].includes(shieldType)) {
      return res.status(400).json({ message: 'Invalid shield type' });
    }

    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone required' });
    }

    let agent = null;
    if (agentCode) {
      agent = await prisma.agent.findUnique({ where: { agentCode } });
      if (!agent || !agent.isActive) {
        return res.status(400).json({ message: 'Invalid agent code' });
      }
      // Block self-referral
      if (agent.email.toLowerCase() === email.toLowerCase() || agent.phone === phone) {
        return res.status(400).json({ message: 'You cannot use your own agent code' });
      }
    }

    const config = SHIELD_CONFIG[shieldType];

    const parseRequest = await prisma.parseRequest.create({
      data: {
        email,
        phone,
        shieldType,
        status: 'PENDING',
        agentCode: agent ? agentCode : null
      }
    });

    const billData = new URLSearchParams();
    billData.append('userSecretKey', TOYYIBPAY_SECRET_KEY);
    billData.append('categoryCode', config.categoryCode);
    billData.append('billName', config.label);
    billData.append('billDescription', `${config.label} - One Time Payment`);
    billData.append('billPriceSetting', 1);
    billData.append('billPayorInfo', 1);
    billData.append('billAmount', config.amount);
    billData.append('billReturnUrl', `${FRONTEND_URL}/parse?ref=${parseRequest.id}`);
    billData.append('billCallbackUrl', `${process.env.BACKEND_URL}/api/payment/webhook`);
    billData.append('billExternalReferenceNo', parseRequest.id);
    billData.append('billTo', email);
    billData.append('billEmail', email);
    billData.append('billPhone', phone);
    billData.append('billSplitPayment', 0);
    billData.append('billSplitPaymentArgs', '');
    billData.append('billPaymentChannel', 0);
    billData.append('billDisplayMerchant', 1);
    billData.append('billContentEmail', `Thank you for your ${config.label} payment`);
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

    await prisma.parseRequest.update({
      where: { id: parseRequest.id },
      data: { billCode }
    });

    res.json({
      parseRequestId: parseRequest.id,
      billCode,
      paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}`
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// WEBHOOK — ToyyibPay sends: status_id, transaction_id, billcode, order_id
const webhook = async (req, res) => {
  try {
    console.log('ToyyibPay webhook received:', req.body);

    const {
      status_id,
      transaction_id,
      billcode,
      order_id
    } = req.body;

    // status_id 1 = success, 2 = pending, 3 = failed
    if (status_id !== '1') {
      console.log('Payment not successful. status_id:', status_id);
      return res.status(200).send('OK');
    }

    if (!order_id) {
      console.log('No order_id in webhook');
      return res.status(200).send('OK');
    }

    const parseRequest = await prisma.parseRequest.findUnique({
      where: { id: order_id }
    });

    if (!parseRequest) {
      console.log('ParseRequest not found for order_id:', order_id);
      return res.status(200).send('OK');
    }

    if (parseRequest.status === 'PAID' || parseRequest.status === 'PARSED') {
      console.log('Already processed:', order_id);
      return res.status(200).send('OK');
    }

    await prisma.parseRequest.update({
      where: { id: parseRequest.id },
      data: {
        status: 'PAID',
        paymentRef: transaction_id
      }
    });

    if (parseRequest.agentCode) {
      await prisma.agent.update({
        where: { agentCode: parseRequest.agentCode },
        data: {
          pendingBalance: { increment: 5.00 },
          totalEarned: { increment: 5.00 }
        }
      });
      console.log('Agent commission credited for:', parseRequest.agentCode);
    }

    await sendPaymentConfirmationEmail(
      parseRequest.email,
      parseRequest.shieldType,
      parseRequest.id
    );

    console.log('Payment confirmed for:', parseRequest.email);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK');
  }
};

// CHECK PAYMENT STATUS
const checkPaymentStatus = async (req, res) => {
  try {
    const { parseRequestId } = req.params;

    const parseRequest = await prisma.parseRequest.findUnique({
      where: { id: parseRequestId }
    });

    if (!parseRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      status: parseRequest.status,
      shieldType: parseRequest.shieldType,
      parseRequestId: parseRequest.id
    });

  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createBill,
  webhook,
  checkPaymentStatus
};