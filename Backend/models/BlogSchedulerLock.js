const mongoose = require('mongoose');

const BlogSchedulerLockSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogSchedulerLock', BlogSchedulerLockSchema);
