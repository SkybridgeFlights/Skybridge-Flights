// models/VisaApplication.js
const mongoose = require('mongoose');

const visaApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true },
    passportNumber: { type: String, required: true },
    country: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VisaApplication', visaApplicationSchema);