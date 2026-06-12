const Anthropic = require('@anthropic-ai/sdk');
const cloudinary = require('cloudinary').v2;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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

const MOTOR_PROMPT = `You are an expert Malaysian motor insurance policy analyzer and consumer rights advisor with 26 years of automotive banking experience.

Analyze this motor insurance policy schedule and return a JSON object with TWO sections:
1. extracted_data - raw fields from the policy
2. rights_brief - plain language rights interpretation for the policyholder

Return ONLY valid JSON. No explanation. No markdown. No extra text.

{
  "extracted_data": {
    "insurer_name": "Name of insurance company",
    "policy_number": "Policy number",
    "vehicle_number": "Vehicle registration number",
    "policy_start_date": "YYYY-MM-DD",
    "policy_end_date": "YYYY-MM-DD",
    "valuation_type": "AGREED VALUE or MARKET VALUE",
    "sum_insured": "Amount in RM e.g. RM45000",
    "ncd_percentage": "NCD percentage e.g. 55%",
    "windscreen_covered": true or false,
    "windscreen_limit": "Amount in RM or null",
    "towing_benefit": "Description or null",
    "named_driver": "Named driver or All Drivers"
  },
  "rights_brief": {
    "valuation_rights": "Explanation in Bahasa Malaysia (mixing standard English insurance terms naturally, e.g. 'Agreed Value', 'NCD') of what agreed/market value means for THIS policyholder with the exact amount. What they are entitled to in total loss. What warning applies.",
    "ncd_rights": "Explanation in Bahasa Malaysia of their NCD protection. What they must do to protect it. What voids it.",
    "towing_rights": "Explanation in Bahasa Malaysia of towing rights, including the exact script to say to the tow truck driver.",
    "windscreen_rights": "Explanation in Bahasa Malaysia of windscreen rights. Whether it affects NCD. What to do.",
    "hidden_clause_warnings": "Warning in Bahasa Malaysia about any concerning clauses, limitations, or missing coverage. Be specific. If none found, state NONE DETECTED.",
    "emergency_action": "Step by step in Bahasa Malaysia what to do in the first 10 minutes after an accident. Specific and actionable, written as if speaking directly to the policyholder."
  }
}

If any extracted_data field cannot be found, use null.
For rights_brief, always provide helpful guidance even with limited data.`;

const MEDICAL_PROMPT = `You are an expert Malaysian medical insurance policy analyzer and consumer rights advisor with deep knowledge of Malaysian hospital admission procedures and insurance claim processes.

Analyze this medical/life insurance policy schedule and return a JSON object with TWO sections:
1. extracted_data - raw fields from the policy
2. rights_brief - plain language rights interpretation for the policyholder

Return ONLY valid JSON. No explanation. No markdown. No extra text.

{
  "extracted_data": {
    "insurer_name": "Name of insurance company",
    "policy_number": "Policy number",
    "policy_holder": "Name of policy holder",
    "policy_start_date": "YYYY-MM-DD",
    "policy_end_date": "YYYY-MM-DD",
    "room_and_board_limit": "Amount per day in RM e.g. RM250",
    "annual_limit": "Maximum annual benefit in RM",
    "co_payment": true or false,
    "co_payment_percentage": "Percentage if co_payment is true, else null",
    "waiting_period_days": "Waiting period in days as integer",
    "inception_date": "YYYY-MM-DD original policy start date",
    "panel_network": "Insurer name for panel lookup"
  },
  "rights_brief": {
    "ward_entitlement": "Explanation in Bahasa Malaysia of the exact ward type and hospitals they are entitled to based on their R&B limit, including the exact script to say at the admission counter and what to reject.",
    "annual_limit_rights": "Explanation in Bahasa Malaysia of their annual limit. Whether they are at risk of exceeding it.",
    "copayment_rights": "Explanation in Bahasa Malaysia of co-payment status. If YES - exact ringgit impact on a typical claim. If NO - confirmation they pay zero at discharge.",
    "maturity_rights": "Explanation in Bahasa Malaysia, based on inception date and waiting period, of whether they are fully matured and what is/is not covered right now.",
    "hidden_clause_warnings": "Warning in Bahasa Malaysia about any concerning clauses, premium escalation risk, coverage gaps, or things the agent may not have explained. Be specific. If none found, state NONE DETECTED.",
    "emergency_action": "Step by step in Bahasa Malaysia what to do when arriving at hospital for admission, including the exact script to use at the counter."
  }
}

If any extracted_data field cannot be found, use null.
For rights_brief, always provide helpful guidance even with limited data.`;

// PARSE POLICY
const parsePolicy = async (req, res) => {
  let cloudinaryPublicId = null;

  try {
    const { parseRequestId, shieldType } = req.body;

    if (!parseRequestId) {
      return res.status(400).json({ message: 'Parse request ID required' });
    }

    if (!['MOTOR', 'MEDICAL'].includes(shieldType)) {
      return res.status(400).json({ message: 'Invalid shield type' });
    }

    // Verify payment
    const parseRequest = await prisma.parseRequest.findUnique({
      where: { id: parseRequestId }
    });

    if (!parseRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (parseRequest.status !== 'PAID') {
      return res.status(403).json({ message: 'Payment required before parsing' });
    }

    if (parseRequest.shieldType !== shieldType) {
      return res.status(400).json({ message: 'Shield type mismatch' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // req.file.buffer is available directly via multer memoryStorage — no disk I/O
    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const base64File = fileBuffer.toString('base64');

    // Upload to Cloudinary from buffer (data URI) — temporary, deleted right after
    const dataUri = `data:${mimeType};base64,${base64File}`;
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: 'ikmr-temp',
      resource_type: 'auto'
    });
    cloudinaryPublicId = uploadResult.public_id;

    const prompt = shieldType === 'MOTOR' ? MOTOR_PROMPT : MEDICAL_PROMPT;

    // Call Claude Sonnet
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64File
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    // Delete from Cloudinary immediately
    await cloudinary.uploader.destroy(cloudinaryPublicId, {
      resource_type: uploadResult.resource_type
    });
    cloudinaryPublicId = null;

    // Parse Claude response
    const responseText = message.content[0].text.trim();
    let parsedData;

    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ message: 'Failed to parse policy. Please try a clearer image or PDF.' });
      }
    }

    // Get insurer info
    const insurerName = parsedData.extracted_data?.insurer_name;
    const insurerInfo = getInsurerInfo(insurerName);

    // Calculate maturity for medical
    let maturityStatus = null;
    let daysToMaturity = null;
    if (shieldType === 'MEDICAL') {
      const inceptionDate = parsedData.extracted_data?.inception_date;
      const waitingDays = parsedData.extracted_data?.waiting_period_days;
      if (inceptionDate && waitingDays) {
        const maturityDate = new Date(inceptionDate);
        maturityDate.setDate(maturityDate.getDate() + parseInt(waitingDays));
        const today = new Date();
        if (today >= maturityDate) {
          maturityStatus = 'MATURED';
        } else {
          maturityStatus = 'IN_WAITING';
          daysToMaturity = Math.ceil((maturityDate - today) / (1000 * 60 * 60 * 24));
        }
      }
    }

    // Mark as parsed
    await prisma.parseRequest.update({
      where: { id: parseRequestId },
      data: { status: 'PARSED' }
    });

    // Return full data to frontend — NOT stored on server
    res.json({
      message: 'Policy parsed successfully',
      shieldType,
      extractedData: parsedData.extracted_data,
      rightsBrief: parsedData.rights_brief,
      insurerInfo,
      maturityStatus,
      daysToMaturity,
      parsedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Parser error:', error);

    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId);
      } catch (e) {
        console.error('Cloudinary cleanup error:', e);
      }
    }

    // Mark as failed
    if (req.body?.parseRequestId) {
      try {
        await prisma.parseRequest.update({
          where: { id: req.body.parseRequestId },
          data: { status: 'FAILED' }
        });
      } catch (e) {
        console.error('Status update error:', e);
      }
    }

    res.status(500).json({ message: 'Server error during parsing' });
  }
};

module.exports = { parsePolicy };