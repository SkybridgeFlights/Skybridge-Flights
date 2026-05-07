const mongoose = require('mongoose');

const BlogJobSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['generate_article', 'auto_publish', 'regenerate_seo', 'search_console_sync'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    logs: [
      {
        at: { type: Date, default: Date.now },
        level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
        message: { type: String, default: '' },
      },
    ],
    attempts: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 2 },
    lockedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: Date.now, index: true },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

BlogJobSchema.index({ status: 1, nextRunAt: 1, createdAt: 1 });

module.exports = mongoose.model('BlogJob', BlogJobSchema);
