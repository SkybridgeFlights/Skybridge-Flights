const mongoose = require('mongoose');

const BlogVersionSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['post', 'seoPage'], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    source: { type: String, default: 'admin' },
    action: { type: String, default: '' },
  },
  { timestamps: true }
);

BlogVersionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('BlogVersion', BlogVersionSchema);
