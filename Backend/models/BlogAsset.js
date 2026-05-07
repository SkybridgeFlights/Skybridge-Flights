const mongoose = require('mongoose');

const BlogAssetSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    url: { type: String, required: true, trim: true },
    altText: { type: String, default: '', trim: true },
    provider: { type: String, default: 'external', trim: true },
    publicId: { type: String, default: '', trim: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    format: { type: String, default: '', trim: true },
    source: { type: String, enum: ['uploaded', 'generated', 'external', 'prompt-only'], default: 'external' },
    prompt: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogAsset', BlogAssetSchema);
