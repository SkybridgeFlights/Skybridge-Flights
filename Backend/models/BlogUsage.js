const mongoose = require('mongoose');

const BlogUsageSchema = new mongoose.Schema(
  {
    periodKey: { type: String, required: true, unique: true, index: true },
    periodType: { type: String, enum: ['day', 'month'], required: true },
    articlesGenerated: { type: Number, default: 0 },
    estimatedTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    failedJobs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogUsage', BlogUsageSchema);
