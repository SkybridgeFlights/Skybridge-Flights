// controllers/bookingController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Flight  = require('../models/Flight');

/**
 * POST /api/bookings
 * إنشاء حجز الذهاب (Single or start of round-trip)
 * - يتم إنشاء الحجز بحالة "pending"
 * - التأكيد يتم لاحقاً عبر /:id/confirm بعد "الدفع"
 */
exports.createBooking = async (req, res) => {
  try {
    const {
      flightId,
      returnFlightId, // يُرسل فقط للمعلومة (لا نخزنه هنا)
      passengers,
      seatNumber,
      extraWeight,
      totalPrice,
      paymentMethod,
      petDetails,
      contact, // { email, address{...} }
    } = req.body;

    if (!flightId || !paymentMethod) {
      return res.status(400).json({ error: 'flightId and paymentMethod are required.' });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ error: 'At least one passenger is required.' });
    }

    const flight = await Flight.findById(flightId);
    if (!flight) {
      return res.status(404).json({ error: 'Flight not found.' });
    }

    // تحقق من المقعد للذهاب
    if (seatNumber) {
      const exists = await Booking.findOne({ flight: flightId, seatNumber });
      if (exists) {
        return res.status(400).json({ error: 'Seat already booked for the outbound flight.' });
      }
    }

    const booking = await Booking.create({
      user: req.user._id,
      flight: flightId,
      passengers,
      seatNumber: seatNumber || null,
      extraWeight: extraWeight || 0,
      totalPrice: typeof totalPrice === 'number' ? totalPrice : flight.price,
      paymentMethod,
      petDetails: petDetails || null,
      contact: contact || {},
      status: 'pending',          // ✅ مبدئياً Pending
      refundStatus: 'none',
      refundAmount: 0
    });

    return res.status(201).json({
      message: 'Outbound booking created successfully (pending).',
      bookingId: booking._id,
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
};

/**
 * PATCH /api/bookings/:id/confirm
 * تأكيد الدفع وتحديث حالة الحجز إلى confirmed
 */
exports.confirmBookingPayment = async (req, res) => {
  try {
    const bookingId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    // السماح لصاحب الحجز أو الأدمن فقط
    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // لا تؤكد إذا كانت ملغاة
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot confirm a cancelled booking.' });
    }

    booking.status = 'confirmed';
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate('flight')
      .populate('returnFlight');

    res.json({
      message: 'Booking confirmed successfully.',
      booking: populated,
    });
  } catch (error) {
    console.error('confirmBookingPayment error:', error);
    return res.status(500).json({ error: 'Failed to confirm booking payment' });
  }
};

/**
 * PUT /api/bookings/:id/attach-return
 * ربط رحلة الإياب بالحجز الموجود
 */
exports.attachReturnFlight = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      returnFlightId,
      passengersReturn,
      seatNumberReturn,
      extraWeightReturn,
      totalPriceReturn,
      petDetailsReturn,
      contactReturn,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    // التأكد أن الحجز يعود لنفس المستخدم أو أدمن
    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const returnFlight = await Flight.findById(returnFlightId);
    if (!returnFlight) {
      return res.status(404).json({ error: 'Return flight not found.' });
    }

    // فحص المقعد للإياب
    if (seatNumberReturn) {
      const exists = await Booking.findOne({
        returnFlight: returnFlightId,
        seatNumberReturn: seatNumberReturn,
      });
      if (exists) {
        return res.status(400).json({ error: 'Seat already booked for the return flight.' });
      }
    }

    booking.returnFlight      = returnFlightId;
    booking.passengersReturn  = Array.isArray(passengersReturn) ? passengersReturn : [];
    booking.seatNumberReturn  = seatNumberReturn || null;
    booking.extraWeightReturn = extraWeightReturn || 0;
    booking.totalPriceReturn  = typeof totalPriceReturn === 'number' ? totalPriceReturn : returnFlight.price;
    booking.petDetailsReturn  = petDetailsReturn || null;
    booking.contactReturn     = contactReturn || {};

    await booking.save();

    res.json({
      message: 'Return flight attached successfully.',
      bookingId: booking._id,
    });
  } catch (err) {
    console.error('attachReturnFlight error:', err);
    res.status(500).json({ error: 'Failed to attach return flight' });
  }
};

/**
 * GET /api/bookings/mine
 * يعيد الحجوزات الخاصة بالمستخدم الحالي فقط
 */
exports.myBookings = async (req, res) => {
  try {
    console.log('🔑 Current User (myBookings):', req.user?._id?.toString(), req.user?.email);

    const bookings = await Booking.find({ user: req.user._id })
      .populate('flight')
      .populate('returnFlight')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error('myBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch your bookings' });
  }
};

/**
 * GET /api/bookings/:id
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('flight')
      .populate('returnFlight');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(booking);
  } catch (err) {
    console.error('getBookingById error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

/**
 * PATCH /api/bookings/:id/cancel
 */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('cancelBooking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

/**
 * GET /api/bookings
 * (Admin only)
 */
exports.listAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('flight')
      .populate('returnFlight')
      .populate('user', 'name email');
    res.json(bookings);
  } catch (err) {
    console.error('listAllBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

/**
 * GET /api/bookings/flight/:flightId/seats
 */
exports.getBookedSeatsByFlight = async (req, res) => {
  try {
    const flightId = req.params.flightId;
    const bookings = await Booking.find({ flight: flightId }, 'seatNumber');
    const seats = bookings.map((b) => b.seatNumber).filter(Boolean);
    res.json({ bookedSeats: seats });
  } catch (err) {
    console.error('getBookedSeatsByFlight error:', err);
    res.status(500).json({ error: 'Failed to fetch booked seats' });
  }
};