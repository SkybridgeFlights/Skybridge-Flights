const axios = require('axios');
const BlogSettings = require('../models/BlogSettings');
const sendEmail = require('../utils/sendEmail');
const { buildAlertTemplate } = require('./blogAlertTemplateService');
const { blogLog } = require('./blogLoggerService');

const importantTypes = new Set([
  'ai_generation_failed',
  'auto_publish_failed',
  'broken_links',
  'sitemap_issues',
  'budget_limit',
  'search_console_failed',
  'duplicate_similarity',
  'publish_blocked',
  'qa_summary',
]);

const severityRank = { info: 0, warning: 1, error: 2 };

function inQuietHours(settings, now = new Date()) {
  const quiet = settings?.notificationQuietHours || {};
  if (!quiet.enabled) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value, fallback) => {
    const [hour, minute] = String(value || fallback).split(':').map(Number);
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
  };
  const start = toMinutes(quiet.start, '22:00');
  const end = toMinutes(quiet.end, '07:00');
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function shouldDeliver(notification, settings) {
  if (!importantTypes.has(notification.type)) return false;
  const threshold = settings?.notificationSeverityThreshold || 'error';
  if ((severityRank[notification.severity] || 0) < (severityRank[threshold] || 0)) return false;
  if (inQuietHours(settings) && notification.severity !== 'error') return false;
  return true;
}

async function deliverEmail(notification, settings, template) {
  const recipients = (settings.notificationRecipients || []).filter(Boolean);
  if (!settings.emailNotificationsEnabled || !recipients.length || !sendEmail.isEmailConfigured?.()) {
    return { attempted: false, delivered: false, error: '' };
  }
  const results = [];
  for (const to of recipients) {
    const result = await sendEmail({ to, subject: template.subject, html: template.html });
    results.push(!!result);
  }
  const delivered = results.some(Boolean);
  return {
    attempted: true,
    delivered,
    error: delivered ? '' : 'Email provider returned no successful deliveries',
    deliveredAt: delivered ? new Date() : null,
  };
}

async function deliverWhatsapp(notification, settings, template) {
  const recipients = (settings.whatsappNotificationRecipients || []).filter(Boolean);
  const webhookUrl = process.env.BLOG_WHATSAPP_WEBHOOK_URL || process.env.WHATSAPP_WEBHOOK_URL || '';
  if (!settings.whatsappNotificationsEnabled || !recipients.length || !webhookUrl) {
    return { attempted: false, delivered: false, error: '' };
  }
  try {
    await axios.post(webhookUrl, {
      recipients,
      text: template.text,
      notificationType: notification.type,
      severity: notification.severity,
    }, { timeout: 8000 });
    return { attempted: true, delivered: true, error: '', deliveredAt: new Date() };
  } catch (error) {
    return { attempted: true, delivered: false, error: error.message };
  }
}

async function deliverNotification(notification) {
  try {
    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean();
    if (!settings || !shouldDeliver(notification, settings)) return notification;
    const template = buildAlertTemplate(notification);
    const [email, whatsapp] = await Promise.all([
      deliverEmail(notification, settings, template),
      deliverWhatsapp(notification, settings, template),
    ]);
    notification.delivery = {
      email: { ...(notification.delivery?.email || {}), ...email },
      whatsapp: { ...(notification.delivery?.whatsapp || {}), ...whatsapp },
    };
    await notification.save();
    blogLog('notification.delivery_completed', {
      id: notification._id,
      type: notification.type,
      severity: notification.severity,
      email: { attempted: email.attempted, delivered: email.delivered },
      whatsapp: { attempted: whatsapp.attempted, delivered: whatsapp.delivered },
    });
    return notification;
  } catch (error) {
    blogLog('notification.delivery_failed', {
      id: notification?._id,
      type: notification?.type,
      message: error.message,
    }, 'warn');
    return notification;
  }
}

module.exports = {
  deliverNotification,
  shouldDeliver,
};
