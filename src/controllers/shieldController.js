const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Panel network lookup table by insurer
const INSURER_HOTLINES = {
  'allianz': { hotline: '1-800-22-5542', panelUrl: 'https://www.allianz.com.my/find-a-workshop' },
  'aia': { hotline: '1-800-88-1899', panelUrl: 'https://www.aia.com.my/en/find-a-doctor.html' },
  'etiqa': { hotline: '1-300-13-1300', panelUrl: 'https://www.etiqa.com.my/panel-hospitals' },
  'takaful malaysia': { hotline: '1-800-88-2525', panelUrl: 'https://www.takaful-malaysia.com.my/panel' },
  'takaful ikhlas': { hotline: '1-800-88-1108', panelUrl: 'https://www.takafulikhlas.com.my/panel' },
  'zurich': { hotline: '1-800-88-6222', panelUrl: 'https://www.zurich.com.my/find-a-workshop' },
  'tokio marine': { hotline: '1-800-88-1007', panelUrl: 'https://www.tokiomarine.com.my/panel' },
  'berjaya sompo': { hotline: '1-800-88-3033', panelUrl: 'https://www.berjayasompo.com.my/panel' },
  'tune': { hotline: '1-800-88-5753', panelUrl: 'https://www.tuneprotect.com/panel' },
  'kurnia': { hotline: '1-800-88-3833', panelUrl: 'https://www.kurnia.com/panel' },
  'lonpac': { hotline: '03-2262-8688', panelUrl: 'https://www.lonpac.com/panel' },
  'pacific': { hotline: '1-800-88-6333', panelUrl: 'https://www.pacificinsurance.com.my/panel' },
  'great eastern': { hotline: '1-300-1300-78', panelUrl: 'https://www.greateasternlife.com/my/panel' },
  'prudential': { hotline: '1-800-22-8388', panelUrl: 'https://www.prudential.com.my/panel' },
  'manulife': { hotline: '1-800-18-5600', panelUrl: 'https://www.manulife.com.my/panel' },
  'sun life': { hotline: '03-2034-2288', panelUrl: 'https://www.sunlifemalaysia.com/panel' }
};

const getInsurerInfo = (insurerName) => {
  if (!insurerName) return null;
  const key = insurerName.toLowerCase();
  for (const [name, info] of Object.entries(INSURER_HOTLINES)) {
    if (key.includes(name)) return { name: insurerName, ...info };
  }
  return { name: insurerName, hotline: null, panelUrl: null };
};

// GET CRISIS SCREEN DATA
const getCrisisScreen = async (req, res) => {
  try {
    const userId = req.userId;

    // Check active subscription
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return res.status(403).json({ message: 'No active subscription' });
    }

    // Get all parsed shields
    const shields = await prisma.parsedShield.findMany({
      where: { userId }
    });

    const motorShield = shields.find(s => s.shieldType === 'MOTOR');
    const medicalShield = shields.find(s => s.shieldType === 'MEDICAL');

    // Build motor crisis data
    let motorData = null;
    if (motorShield) {
      const p = motorShield.parsedJson;
      const insurerInfo = getInsurerInfo(motorShield.insurerName);
      motorData = {
        insurerName: motorShield.insurerName,
        policyNumber: p.policy_number,
        vehicleNumber: p.vehicle_number,
        policyEndDate: p.policy_end_date,
        valuationType: p.valuation_type,
        sumInsured: p.sum_insured,
        ncdPercentage: p.ncd_percentage,
        windscreenCovered: p.windscreen_covered,
        windscreenLimit: p.windscreen_limit,
        towingBenefit: p.towing_benefit,
        namedDriver: p.named_driver,
        hotline: insurerInfo?.hotline || null,
        panelUrl: insurerInfo?.panelUrl || null,
        uploadedAt: motorShield.uploadedAt
      };
    }

    // Build medical crisis data
    let medicalData = null;
    if (medicalShield) {
      const p = medicalShield.parsedJson;
      const insurerInfo = getInsurerInfo(medicalShield.insurerName);

      // Calculate maturity status
      let maturityStatus = null;
      let daysToMaturity = null;
      if (p.inception_date && p.waiting_period_days) {
        const inceptionDate = new Date(p.inception_date);
        const maturityDate = new Date(inceptionDate);
        maturityDate.setDate(maturityDate.getDate() + parseInt(p.waiting_period_days));
        const today = new Date();
        if (today >= maturityDate) {
          maturityStatus = 'MATURED';
        } else {
          maturityStatus = 'IN_WAITING';
          daysToMaturity = Math.ceil((maturityDate - today) / (1000 * 60 * 60 * 24));
        }
      }

      medicalData = {
        insurerName: medicalShield.insurerName,
        policyNumber: p.policy_number,
        policyHolder: p.policy_holder,
        policyEndDate: p.policy_end_date,
        roomAndBoardLimit: p.room_and_board_limit,
        annualLimit: p.annual_limit,
        coPayment: p.co_payment,
        coPaymentPercentage: p.co_payment_percentage,
        maturityStatus,
        daysToMaturity,
        panelNetwork: p.panel_network,
        hotline: insurerInfo?.hotline || null,
        panelUrl: insurerInfo?.panelUrl || null,
        uploadedAt: medicalShield.uploadedAt
      };
    }

    res.json({
      subscription: {
        shieldType: subscription.shieldType,
        activatedAt: subscription.activatedAt,
        expiresAt: subscription.expiresAt,
        status: subscription.status
      },
      motorData,
      medicalData
    });

  } catch (error) {
    console.error('Crisis screen error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET SHIELDS UPLOADED STATUS
const getShieldsStatus = async (req, res) => {
  try {
    const userId = req.userId;

    const shields = await prisma.parsedShield.findMany({
      where: { userId },
      select: {
        shieldType: true,
        insurerName: true,
        uploadedAt: true
      }
    });

    res.json({ shields });

  } catch (error) {
    console.error('Get shields error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCrisisScreen,
  getShieldsStatus
};