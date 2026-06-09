const Anthropic = require('@anthropic-ai/sdk');
const cloudinary = require('cloudinary').v2;
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MOTOR_PROMPT = `You are an expert Malaysian motor insurance policy analyzer.
Extract ONLY these exact fields from the uploaded policy schedule document.
Return ONLY valid JSON. No explanation. No markdown. No extra text.

{
  "insurer_name": "Name of insurance company",
  "policy_number": "Policy number",
  "vehicle_number": "Vehicle registration number",
  "policy_start_date": "YYYY-MM-DD",
  "policy_end_date": "YYYY-MM-DD",
  "valuation_type": "AGREED VALUE or MARKET VALUE",
  "sum_insured": "Amount in RM e.g. RM45000",
  "ncd_percentage": "NCD percentage e.g. 55%",
  "windscreen_covered": true or false,
  "windscreen_limit": "Amount in RM or null if not covered",
  "towing_benefit": "Description of towing benefit or null",
  "named_driver": "Named driver or All Drivers"
}

If any field cannot be found, use null.`;

const MEDICAL_PROMPT = `You are an expert Malaysian medical/life insurance policy analyzer.
Extract ONLY these exact fields from the uploaded policy schedule document.
Return ONLY valid JSON. No explanation. No markdown. No extra text.

{
  "insurer_name": "Name of insurance company",
  "policy_number": "Policy number",
  "policy_holder": "Name of policy holder",
  "policy_start_date": "YYYY-MM-DD",
  "policy_end_date": "YYYY-MM-DD",
  "room_and_board_limit": "Amount per day in RM e.g. RM250",
  "annual_limit": "Maximum annual benefit in RM e.g. RM1500000",
  "co_payment": true or false,
  "co_payment_percentage": "Percentage if co_payment is true, else null",
  "waiting_period_days": "Waiting period in days as integer e.g. 30",
  "inception_date": "YYYY-MM-DD - original policy start date",
  "panel_network": "Insurer name for panel lookup e.g. Allianz, AIA, Etiqa"
}

If any field cannot be found, use null.`;

// PARSE POLICY
const parsePolicy = async (req, res) => {
  let cloudinaryPublicId = null;

  try {
    const userId = req.userId;
    const { shieldType } = req.body;

    if (!['MOTOR', 'MEDICAL'].includes(shieldType)) {
      return res.status(400).json({ message: 'Invalid shield type. Use MOTOR or MEDICAL' });
    }

    // Check active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      }
    });

    if (!subscription) {
      return res.status(403).json({ message: 'No active subscription found' });
    }

    // Check shield type access
    if (subscription.shieldType === 'MOTOR' && shieldType === 'MEDICAL') {
      return res.status(403).json({ message: 'Upgrade to Bundle Shield to access Medical Shield' });
    }
    if (subscription.shieldType === 'MEDICAL' && shieldType === 'MOTOR') {
      return res.status(403).json({ message: 'Upgrade to Bundle Shield to access Motor Shield' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Cloudinary temporarily
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ikmr-temp',
      resource_type: 'auto'
    });

    cloudinaryPublicId = uploadResult.public_id;

    // Read file as base64
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64File = fileBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Determine media type for Claude
    let mediaType = mimeType;
    if (mimeType === 'application/pdf') {
      mediaType = 'application/pdf';
    }

    const prompt = shieldType === 'MOTOR' ? MOTOR_PROMPT : MEDICAL_PROMPT;

    // Call Claude Sonnet with vision
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
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

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    // Parse Claude response
    const responseText = message.content[0].text.trim();
    let parsedJson;

    try {
      parsedJson = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ message: 'Failed to parse policy document. Please try a clearer image.' });
      }
    }

    // Save or update parsed shield
    const existingShield = await prisma.parsedShield.findFirst({
      where: { userId, shieldType }
    });

    let shield;
    if (existingShield) {
      shield = await prisma.parsedShield.update({
        where: { id: existingShield.id },
        data: {
          insurerName: parsedJson.insurer_name || null,
          parsedJson,
          uploadedAt: new Date()
        }
      });
    } else {
      shield = await prisma.parsedShield.create({
        data: {
          userId,
          shieldType,
          insurerName: parsedJson.insurer_name || null,
          parsedJson
        }
      });
    }

    res.json({
      message: 'Policy parsed successfully',
      shield: {
        id: shield.id,
        shieldType: shield.shieldType,
        insurerName: shield.insurerName,
        parsedJson: shield.parsedJson,
        uploadedAt: shield.uploadedAt
      }
    });

  } catch (error) {
    console.error('Parser error:', error);

    // Cleanup Cloudinary if upload happened
    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId);
      } catch (cleanupError) {
        console.error('Cloudinary cleanup error:', cleanupError);
      }
    }

    // Cleanup local file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ message: 'Server error during parsing' });
  }
};

module.exports = { parsePolicy };