const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },

    redirectBaseUrl: { type: String, required: true, trim: true },
    affiliateCode: { type: String, default: '', trim: true },

    logoUrl: { type: String, default: '', trim: true },
    displayOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Provider', ProviderSchema);