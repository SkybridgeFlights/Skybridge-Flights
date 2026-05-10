const mongoose = require('mongoose');

const adClickEventSchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, trim: true, index: true },
    campaign: { type: String, trim: true, default: '', index: true },
    destination: { type: String, trim: true, default: '' },
    sessionId: { type: String, trim: true, default: '', index: true },
    visitorId: { type: String, trim: true, default: '', index: true },
    page: { type: String, trim: true, default: '/', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adClickEventSchema.index({ createdAt: -1 });
adClickEventSchema.index({ slotId: 1, createdAt: -1 });

module.exports = mongoose.model('AdClickEvent', adClickEventSchema);
