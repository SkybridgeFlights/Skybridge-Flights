// Backend/models/SupportThread.js
const mongoose = require('mongoose');

const SupportThreadSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  status: { type: String, enum: ['open','pending','closed'], default: 'open' }
}, { timestamps: true });

module.exports = mongoose.model('SupportThread', SupportThreadSchema);