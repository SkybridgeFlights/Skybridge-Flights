// Backend/models/SupportMessage.js
const mongoose = require('mongoose');

const SupportMessageSchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportThread', required: true },
  byKind: { type: String, enum: ['user','staff'], required: true },
  by: { type: mongoose.Schema.Types.ObjectId, required: true },
  byName: String,
  text: String,
  files: [{
    r2Key: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedAt: Date,
    publicUrl: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);