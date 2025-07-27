// models/RefundPolicy.js
const mongoose = require('mongoose');

const refundPolicySchema = new mongoose.Schema({
  name: { type: String, required: true },                // e.g., "Default policy"
  rules: [
    {
      minHoursSinceBooking: { type: Number, default: 0 }, // الفاصل الزمني منذ إنشاء الحجز (إن أردت)
      minHoursBeforeDeparture: { type: Number, default: 0 }, // الحد الأدنى للساعات قبل المغادرة
      maxHoursBeforeDeparture: { type: Number, default: null }, // حد أعلى إن وجد
      percent: { type: Number, required: true }, // نسبة الاسترداد (0 - 100)
      fixedFee: { type: Number, default: 0 },    // خصم ثابت إن رغبت
      description: String
    }
  ],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RefundPolicy', refundPolicySchema);