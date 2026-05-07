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
  confirmBookingPayment,
} = require('../controllers/bookingController');

const { protect, requirePerm } = require('../middleware/authMiddleware');

router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'Booking API is working!' });
});

router.get('/flight/:flightId/seats', protect, getBookedSeatsByFlight);

router.get('/mine', protect, myBookings);

router.post('/', protect, createBooking);

router.put('/:id/attach-return', protect, attachReturnFlight);

router.get('/:id', protect, getBookingById);

router.patch('/:id/confirm', protect, confirmBookingPayment);

router.patch('/:id/cancel', protect, cancelBooking);

router.get('/', protect, requirePerm('manageBookings'), listAllBookings);

module.exports = router;