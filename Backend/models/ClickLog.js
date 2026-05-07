const mongoose = require('mongoose');

const ClickLogSchema = new mongoose.Schema(
  {
    providerKey: { type: String, required: true, trim: true, index: true },
    providerName: { type: String, default: '', trim: true },

    from: { type: String, default: '', trim: true },
    to: { type: String, default: '', trim: true },
    date: { type: String, default: '', trim: true },
    returnDate: { type: String, default: '', trim: true },

    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 },
    travelClass: { type: String, default: 'Economy', trim: true },

    finalUrl: { type: String, default: '', trim: true },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    referrer: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClickLog', ClickLogSchema);