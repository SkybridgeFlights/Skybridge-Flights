const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: 'No reason provided' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Processed'], default: 'Pending' },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RefundRequest', refundRequestSchema);