const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// WELCOME EMAIL
const sendWelcomeEmail = async (email, name) => {
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Welcome to IKMR — I Know My Rights',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Welcome to IKMR, ${name}!</h2>
          <p>Your account has been created successfully under <strong>AWAS Premium Resources</strong>.</p>
          <p>IKMR — I Know My Rights is your personal insurance rights decoder. Upload your policy schedule and know exactly what you're entitled to before any crisis hits.</p>
          <p>Next step: Choose your shield and upload your policy.</p>
          <a href="${FRONTEND_URL}" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Go to IKMR</a>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">AWAS Premium Resources | hello@awas.asia</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Welcome email error:', error);
  }
};

// PASSWORD RESET EMAIL
const sendPasswordResetEmail = async (email, name, token) => {
  try {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'IKMR — Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your IKMR password. Click the button below to reset it.</p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Reset Password</a>
          <p style="margin-top: 16px;">If you did not request this, please ignore this email.</p>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">AWAS Premium Resources | hello@awas.asia</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Reset email error:', error);
  }
};

// SUBSCRIPTION ACTIVATED EMAIL
const sendSubscriptionActivatedEmail = async (email, name, shieldType, expiresAt) => {
  try {
    const shieldLabel = shieldType === 'MOTOR' ? 'Motor Shield' :
                        shieldType === 'MEDICAL' ? 'Medical Shield' : 'Bundle Shield';
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `IKMR — Your ${shieldLabel} is Now Active`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Your ${shieldLabel} is Active!</h2>
          <p>Hi ${name},</p>
          <p>Your IKMR subscription has been activated successfully.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Shield Type</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${shieldLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid Until</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${expiryDate}</td>
            </tr>
          </table>
          <p style="margin-top: 16px;">Next step: Upload your policy schedule to activate your Crisis Screen.</p>
          <a href="${FRONTEND_URL}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Upload Policy Now</a>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">AWAS Premium Resources | hello@awas.asia</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Subscription activated email error:', error);
  }
};

// RENEWAL REMINDER EMAIL
const sendRenewalReminderEmail = async (email, name, shieldType, expiresAt, daysLeft) => {
  try {
    const shieldLabel = shieldType === 'MOTOR' ? 'Motor Shield' :
                        shieldType === 'MEDICAL' ? 'Medical Shield' : 'Bundle Shield';
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `IKMR — Your ${shieldLabel} Expires in ${daysLeft} Days`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Action Required — Renew Your Shield</h2>
          <p>Hi ${name},</p>
          <p>Your IKMR <strong>${shieldLabel}</strong> expires in <strong>${daysLeft} days</strong> on ${expiryDate}.</p>
          <p>Renew now to keep your insurance rights protection active. Don't get caught without it.</p>
          <a href="${FRONTEND_URL}/renew" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Renew Now</a>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">AWAS Premium Resources | hello@awas.asia</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Renewal reminder email error:', error);
  }
};

// SUBSCRIPTION EXPIRED EMAIL
const sendSubscriptionExpiredEmail = async (email, name, shieldType) => {
  try {
    const shieldLabel = shieldType === 'MOTOR' ? 'Motor Shield' :
                        shieldType === 'MEDICAL' ? 'Medical Shield' : 'Bundle Shield';

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `IKMR — Your ${shieldLabel} Has Expired`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Your ${shieldLabel} Has Expired</h2>
          <p>Hi ${name},</p>
          <p>Your IKMR <strong>${shieldLabel}</strong> subscription has expired. Your Crisis Screen is no longer active.</p>
          <p>Renew today to restore your insurance rights protection.</p>
          <a href="${FRONTEND_URL}/renew" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Renew Subscription</a>
          <p style="margin-top: 32px; font-size: 12px; color: #666;">AWAS Premium Resources | hello@awas.asia</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Subscription expired email error:', error);
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSubscriptionActivatedEmail,
  sendRenewalReminderEmail,
  sendSubscriptionExpiredEmail
};