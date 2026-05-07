const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    airline: { type: String, required: true, trim: true },
    flightNumber: { type: String, required: true, trim: true },
    departureTime: { type: String, required: true, trim: true },
    arrivalTime: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    class: { type: String, default: 'Economy', trim: true },
    availableSeats: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Flight', flightSchema);