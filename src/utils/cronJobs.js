const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const {
  sendRenewalReminderEmail,
  sendSubscriptionExpiredEmail
} = require('./emailService');

const prisma = new PrismaClient();

const startCronJobs = () => {
  // Run every day at 9am Malaysia time (UTC+8 = 1am UTC)
  cron.schedule('0 1 * * *', async () => {
    console.log('Running daily subscription check...');

    const now = new Date();

    // ── 30-DAY REMINDER ──
    try {
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const thirtyDayStart = new Date(thirtyDaysFromNow);
      thirtyDayStart.setHours(0, 0, 0, 0);
      const thirtyDayEnd = new Date(thirtyDaysFromNow);
      thirtyDayEnd.setHours(23, 59, 59, 999);

      const expiringSoon30 = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          reminder30Sent: false,
          expiresAt: {
            gte: thirtyDayStart,
            lte: thirtyDayEnd
          }
        },
        include: { user: true }
      });

      for (const sub of expiringSoon30) {
        await sendRenewalReminderEmail(
          sub.user.email,
          sub.user.name,
          sub.shieldType,
          sub.expiresAt,
          30
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { reminder30Sent: true }
        });
        console.log(`30-day reminder sent to ${sub.user.email}`);
      }
    } catch (error) {
      console.error('30-day reminder error:', error);
    }

    // ── 7-DAY REMINDER ──
    try {
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sevenDayStart = new Date(sevenDaysFromNow);
      sevenDayStart.setHours(0, 0, 0, 0);
      const sevenDayEnd = new Date(sevenDaysFromNow);
      sevenDayEnd.setHours(23, 59, 59, 999);

      const expiringSoon7 = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          reminder7Sent: false,
          expiresAt: {
            gte: sevenDayStart,
            lte: sevenDayEnd
          }
        },
        include: { user: true }
      });

      for (const sub of expiringSoon7) {
        await sendRenewalReminderEmail(
          sub.user.email,
          sub.user.name,
          sub.shieldType,
          sub.expiresAt,
          7
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { reminder7Sent: true }
        });
        console.log(`7-day reminder sent to ${sub.user.email}`);
      }
    } catch (error) {
      console.error('7-day reminder error:', error);
    }

    // ── EXPIRED SUBSCRIPTIONS ──
    try {
      const expiredSubs = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          expiredNoticeSent: false,
          expiresAt: { lt: now }
        },
        include: { user: true }
      });

      for (const sub of expiredSubs) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'EXPIRED',
            expiredNoticeSent: true
          }
        });
        await sendSubscriptionExpiredEmail(
          sub.user.email,
          sub.user.name,
          sub.shieldType
        );
        console.log(`Expired notice sent to ${sub.user.email}`);
      }
    } catch (error) {
      console.error('Expired subscription error:', error);
    }

    console.log('Daily subscription check complete.');
  });

  console.log('Cron jobs started.');
};

module.exports = { startCronJobs };