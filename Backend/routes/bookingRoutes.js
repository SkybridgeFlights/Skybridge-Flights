// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();

const {
  createBooking,
  attachReturnFlight,
  myBookings,
  cancelBooking,
  getBookingById,
  listAllBookings,
  getBookedSeatsByFlight,
  confirmBookingPayment, // تأكيد الدفع
} = require('../controllers/bookingController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/test', (req, res) => res.json({ ok: true, message: 'Booking API is working!' }));

// جلب المقاعد المحجوزة لرحلة معينة
router.get('/flight/:flightId/seats', protect, getBookedSeatsByFlight);

// حجوزات المستخدم الحالي
router.get('/mine', protect, myBookings);

// إنشاء حجز الذهاب
router.post('/', protect, createBooking);

// تأكيد الدفع
router.patch('/:id/confirm', protect, confirmBookingPayment);

// إلحاق رحلة الإياب
router.put('/:id/attach-return', protect, attachReturnFlight);

// حجز واحد بالتفصيل
router.get('/:id', protect, getBookingById);

// إلغاء حجز
router.patch('/:id/cancel', protect, cancelBooking);

// كل الحجوزات (أدمن فقط)
router.get('/', protect, adminOnly, listAllBookings);

module.exports = router;