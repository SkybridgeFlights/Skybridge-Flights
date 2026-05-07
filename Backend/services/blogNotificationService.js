const BlogNotification = require('../models/BlogNotification');
const { deliverNotification } = require('./blogNotificationDeliveryService');
const { blogLog } = require('./blogLoggerService');

async function createNotification(payload = {}) {
  const notification = await BlogNotification.create({
    type: payload.type || 'qa_summary',
    severity: payload.severity || 'info',
    title: payload.title || 'Blog system notification',
    message: payload.message || '',
    targetType: payload.targetType || '',
    targetId: payload.targetId || null,
    metadata: payload.metadata || {},
  });
  blogLog('notification.created', {
    id: notification._id,
    type: notification.type,
    severity: notification.severity,
    targetType: notification.targetType,
  });
  deliverNotification(notification).catch((error) => {
    blogLog('notification.delivery_async_failed', { id: notification._id, message: error.message }, 'warn');
  });
  return notification;
}

async function listNotifications({ severity = 'all', unreadOnly = false } = {}) {
  const filter = {};
  if (severity && severity !== 'all') filter.severity = severity;
  if (unreadOnly) filter.read = false;
  const [items, unreadCount] = await Promise.all([
    BlogNotification.find(filter).sort({ createdAt: -1 }).limit(60).lean(),
    BlogNotification.countDocuments({ read: false }),
  ]);
  return { items, unreadCount };
}

async function markNotificationRead(id) {
  return BlogNotification.findByIdAndUpdate(id, { read: true }, { new: true });
}

module.exports = {
  createNotification,
  listNotifications,
  markNotificationRead,
};
