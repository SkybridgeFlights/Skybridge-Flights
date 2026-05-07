const mongoose = require('mongoose');

const BlogTopicPerformanceSchema = new mongoose.Schema(
  {
    topicKey: { type: String, required: true, index: true },
    category: { type: String, default: 'travel', index: true },
    language: { type: String, enum: ['en', 'ar', 'de'], default: 'en', index: true },
    articles: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    averageReadTimeSeconds: { type: Number, default: 0 },
    ctaClicks: { type: Number, default: 0 },
    conversionClicks: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    lastArticleAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BlogTopicPerformanceSchema.index({ topicKey: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('BlogTopicPerformance', BlogTopicPerformanceSchema);
