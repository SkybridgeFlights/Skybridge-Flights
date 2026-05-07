const mongoose = require('mongoose');
const dayjs = require('dayjs');

const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const BookingSetting = require('../models/bookingSettingsModel');

const getBookingSettings = async () => {
  return await BookingSetting.findOne({});
};

exports.createBooking = async (req, res) => {
  try {
    const {
      flightId,
      passengers,
      seatNumber,
      extraWeight,
      totalPrice,
      paymentMethod,
      petDetails,
      contact,
    } = req.body;

    if (!flightId) {
      return res.status(400).json({ error: 'flightId is required.' });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ error: 'At least one passenger is required.' });
    }

    const flight = await Flight.findById(flightId);
    if (!flight) {
      return res.status(404).json({ error: 'Flight not found.' });
    }

    if (seatNumber) {
      const exists = await Booking.findOne({ flight: flightId, seatNumber });
      if (exists) {
        return res.status(400).json({ error: 'Seat already booked for the outbound flight.' });
      }
    }

    const settings = await getBookingSettings();

    const sanitizedPaymentMethod =
      typeof paymentMethod === 'string' && paymentMethod.trim()
        ? paymentMethod.trim().toLowerCase()
        : undefined;

    const doc = {
      user: req.user._id,
      flight: flightId,
      passengers,
      seatNumber: seatNumber || null,
      extraWeight: Number(extraWeight || 0),
      totalPrice:
        typeof totalPrice === 'number'
          ? totalPrice
          : Number(flight.price || 0),
      petDetails: petDetails || null,
      contact: contact || {},
      status: sanitizedPaymentMethod === 'online' ? 'confirmed' : 'pending',
      policySnapshot: {
        cancellationPolicy: settings?.cancellationPolicy || '',
        refundPolicy: settings?.refundPolicy || '',
        modificationPolicy: settings?.modificationPolicy || '',
        baggagePolicy: settings?.baggagePolicy || '',
      },
    };

    if (sanitizedPaymentMethod) {
      doc.paymentMethod = sanitizedPaymentMethod;
    }

    const booking = await Booking.create(doc);

    return res.status(201).json({
      message: `Booking created successfully (${booking.status}).`,
      bookingId: booking._id,
      booking,
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
};

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
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const returnFlight = await Flight.findById(returnFlightId);
    if (!returnFlight) {
      return res.status(404).json({ error: 'Return flight not found.' });
    }

    if (seatNumberReturn) {
      const exists = await Booking.findOne({
        returnFlight: returnFlightId,
        seatNumberReturn,
      });

      if (exists) {
        return res.status(400).json({ error: 'Seat already booked for the return flight.' });
      }
    }

    booking.returnFlight = returnFlightId;
    booking.passengersReturn = Array.isArray(passengersReturn) ? passengersReturn : [];
    booking.seatNumberReturn = seatNumberReturn || null;
    booking.extraWeightReturn = Number(extraWeightReturn || 0);
    booking.totalPriceReturn =
      typeof totalPriceReturn === 'number'
        ? totalPriceReturn
        : Number(returnFlight.price || 0);
    booking.petDetailsReturn = petDetailsReturn || null;
    booking.contactReturn = contactReturn || {};

    await booking.save();

    res.json({
      message: 'Return flight attached successfully.',
      bookingId: booking._id,
      booking,
    });
  } catch (err) {
    console.error('attachReturnFlight error:', err);
    res.status(500).json({ error: 'Failed to attach return flight' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('flight');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const settings = await getBookingSettings();
    if (settings?.allowCancellation === false) {
      return res.status(403).json({ error: 'Cancellations are not allowed.' });
    }

    const flightTime = dayjs(booking.flight?.departureTime || booking.flight?.date);
    const now = dayjs();
    const diffHours = flightTime.diff(now, 'hour');

    if (
      settings?.cancellationHoursLimit &&
      diffHours < settings.cancellationHoursLimit
    ) {
      return res.status(400).json({
        error: `Cancellations must be made at least ${settings.cancellationHoursLimit} hours before departure.`,
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    console.error('cancelBooking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

exports.confirmBookingPayment = async (req, res) => {
  try {
    const bookingId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

exports.myBookings = async (req, res) => {
  try {
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

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('flight')
      .populate('returnFlight');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(booking);
  } catch (err) {
    console.error('getBookingById error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

exports.listAllBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.user) {
      filter.user = req.query.user;
    }

    const bookings = await Booking.find(filter)
      .populate('flight')
      .populate('returnFlight')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error('listAllBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

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