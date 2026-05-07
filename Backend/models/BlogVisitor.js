const mongoose = require('mongoose');

const BlogVisitorSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
    visitorHash: { type: String, required: true, index: true },
    language: { type: String, enum: ['en', 'ar', 'de'], default: 'en' },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BlogVisitorSchema.index({ post: 1, visitorHash: 1 }, { unique: true });

module.exports = mongoose.model('BlogVisitor', BlogVisitorSchema);
