const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    date: { type: String, required: true },  // تاريخ الرحلة
    price: { type: Number, required: true }, // سعر الرحلة
    airline: { type: String, required: true }, // شركة الطيران
    flightNumber: { type: String, required: true }, // رقم الرحلة
    departureTime: { type: String, required: true }, // وقت الإقلاع
    arrivalTime: { type: String, required: true },   // وقت الوصول
    duration: { type: String, required: true },      // مدة الرحلة
    class: { type: String, default: 'Economy' },     // فئة السفر
    availableSeats: [String], // المقاعد المتاحة
  },
  { timestamps: true }
);

module.exports = mongoose.model('Flight', flightSchema);