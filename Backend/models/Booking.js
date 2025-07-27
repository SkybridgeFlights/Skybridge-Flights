// models/Booking.js
const mongoose = require('mongoose');

// --- Passenger subdoc (يشمل الإيميل والجندر) ---
const passengerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    passportNumber: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    email: { type: String },
    gender: { type: String, enum: ['Male', 'Female'] },
  },
  { _id: false }
);

// --- Pet subdoc (اختياري) ---
const petSchema = new mongoose.Schema(
  {
    type: String,
    weight: Number,
    additionalInfo: String,
  },
  { _id: false }
);

// --- Address subdoc (اختياري) ---
const addressSchema = new mongoose.Schema(
  {
    country: String,
    city: String,
    street: String,
    zip: String,
  },
  { _id: false }
);

// --- Booking main schema ---
const bookingSchema = new mongoose.Schema(
  {
    // الذهاب
    flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
    passengers: { type: [passengerSchema], default: [] },
    seatNumber: { type: String, default: null },
    extraWeight: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    petDetails: { type: petSchema, default: null },

    // معلومات تواصل الذهاب
    contact: {
      email: String,
      address: { type: addressSchema },
    },

    // الإياب (اختياري – يُضاف لاحقاً عبر attach-return)
    returnFlight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', default: null },
    passengersReturn: { type: [passengerSchema], default: [] },
    seatNumberReturn: { type: String, default: null },
    extraWeightReturn: { type: Number, default: 0 },
    totalPriceReturn: { type: Number, default: 0 },
    petDetailsReturn: { type: petSchema, default: null },

    // معلومات تواصل الإياب (لو أردت تختلف)
    contactReturn: {
      email: String,
      address: { type: addressSchema },
    },

    // طريقة الدفع محفوظة مع الذهاب (لن نغيّرها في الإياب)
    paymentMethod: { type: String, required: true },

    // حالة الحجز
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },

    // **حالة الاسترداد** (جديدة)
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected', 'processed'],
      default: 'none',
    },

    // **قيمة الاسترداد** (جديدة)
    refundAmount: { type: Number, default: 0 },

    // صاحب الحجز
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);