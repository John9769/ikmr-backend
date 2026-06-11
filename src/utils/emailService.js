const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// PAYMENT CONFIRMATION EMAIL
const sendPaymentConfirmationEmail = async (email, shieldType, parseRequestId) => {
  try {
    const shieldLabel = shieldType === 'MOTOR' ? 'Motor Rights Audit' : 'Medical Rights Audit';
    const parseUrl = `${FRONTEND_URL}/parse?ref=${parseRequestId}`;

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `IKMR — Payment Confirmed. Upload Your Policy Now.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Payment Confirmed ✅</h2>
          <p>Your <strong>${shieldLabel}</strong> payment has been received.</p>
          <p>You are now ready to upload your policy schedule for analysis.</p>
          <p><strong>Important:</strong> Use the button below to access your upload page. This link is unique to your payment.</p>
          <a href="${parseUrl}" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">
            Upload My Policy Now
          </a>
          <p style="margin-top: 24px; font-size: 12px; color: #666;">
            If you did not make this payment, please contact us at hello@awas.asia immediately.
          </p>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">
            AWAS Premium Resources | hello@awas.asia
          </p>
        </div>
      `
    });
  } catch (error) {
    console.error('Payment confirmation email error:', error);
  }
};

// AGENT WELCOME EMAIL
const sendAgentWelcomeEmail = async (email, name, agentCode) => {
  try {
    const agentLink = `${FRONTEND_URL}?ref=${agentCode}`;

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Welcome to IKMR Agent Programme — Your Agent Code: ${agentCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Welcome to IKMR Agent Programme, ${name}!</h2>
          <p>You are now an official IKMR referral agent under <strong>AWAS Premium Resources</strong>.</p>
          
          <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">Your Agent Code</p>
            <p style="margin: 8px 0 0; font-size: 28px; font-weight: bold; color: #1a1a2e; letter-spacing: 4px;">${agentCode}</p>
          </div>

          <p><strong>Your unique referral link:</strong></p>
          <p style="background: #f8f9fa; padding: 12px; border-radius: 6px; word-break: break-all;">${agentLink}</p>

          <p>Share this link with your clients. Every time a client completes a policy audit through your link, you earn <strong>RM5.00</strong> commission.</p>

          <h3 style="color: #1a1a2e;">How it works:</h3>
          <ol>
            <li>Share your unique link via WhatsApp, email or social media</li>
            <li>Client clicks your link and pays RM14.99</li>
            <li>Client uploads their policy and gets their rights brief</li>
            <li>You earn RM5.00 credited to your account</li>
            <li>Payout processed on the 15th and 30th of each month</li>
          </ol>

          <p style="margin-top: 32px; font-size: 12px; color: #666;">
            AWAS Premium Resources | hello@awas.asia
          </p>
        </div>
      `
    });
  } catch (error) {
    console.error('Agent welcome email error:', error);
  }
};

// RIGHTS BRIEF EMAIL — sends Crisis Screen to user after parse
const sendRightsBriefEmail = async (email, shieldType, extractedData, rightsBrief) => {
  try {
    const shieldLabel = shieldType === 'MOTOR' ? 'Motor Rights Audit' : 'Medical Rights Audit';
    const insurerName = extractedData?.insurer_name || 'Your Insurer';

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `IKMR — Your ${shieldLabel} Results`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Your ${shieldLabel} is Ready</h2>
          <p>Insurer: <strong>${insurerName}</strong></p>
          <p>Please return to the IKMR website to view your full Crisis Screen. Screenshot it and save to your phone for emergency access.</p>
          <p style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; font-size: 13px;">
            ⚠️ Your rights brief is displayed on screen only and is not stored on our servers. Please screenshot and save it now.
          </p>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">
            AWAS Premium Resources | hello@awas.asia
          </p>
        </div>
      `
    });
  } catch (error) {
    console.error('Rights brief email error:', error);
  }
};

module.exports = {
  sendPaymentConfirmationEmail,
  sendAgentWelcomeEmail,
  sendRightsBriefEmail
};