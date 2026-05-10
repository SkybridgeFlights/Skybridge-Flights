const mongoose = require('mongoose');

const visitorEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, trim: true, index: true },
    path: { type: String, trim: true, default: '/', index: true },
    pageTitle: { type: String, trim: true, default: '' },
    referrer: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: 'direct', index: true },
    userAgent: { type: String, trim: true, default: '' },
    deviceType: { type: String, trim: true, default: 'desktop', index: true },
    browser: { type: String, trim: true, default: 'unknown' },
    countryApprox: { type: String, trim: true, default: '' },
    sessionId: { type: String, trim: true, default: '', index: true },
    visitorId: { type: String, trim: true, default: '', index: true },
    ipHash: { type: String, trim: true, default: '', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

visitorEventSchema.index({ eventType: 1, createdAt: -1 });
visitorEventSchema.index({ path: 1, createdAt: -1 });
visitorEventSchema.index({ visitorId: 1, createdAt: -1 });

module.exports = mongoose.model('VisitorEvent', visitorEventSchema);
