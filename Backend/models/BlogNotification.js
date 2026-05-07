const mongoose = require('mongoose');

const BlogNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'ai_generation_failed',
        'auto_publish_failed',
        'low_seo_score',
        'broken_links',
        'sitemap_issues',
        'budget_limit',
        'search_console_failed',
        'refresh_needed',
        'duplicate_similarity',
        'publish_blocked',
        'qa_summary',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['info', 'warning', 'error'], default: 'info', index: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    targetType: { type: String, default: '' },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false, index: true },
    delivery: {
      email: {
        attempted: { type: Boolean, default: false },
        delivered: { type: Boolean, default: false },
        error: { type: String, default: '' },
        deliveredAt: { type: Date, default: null },
      },
      whatsapp: {
        attempted: { type: Boolean, default: false },
        delivered: { type: Boolean, default: false },
        error: { type: String, default: '' },
        deliveredAt: { type: Date, default: null },
      },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogNotification', BlogNotificationSchema);
