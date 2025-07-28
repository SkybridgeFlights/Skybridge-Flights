const dayjs = require('dayjs');
const RefundRequest = require('../models/RefundRequest');
const Booking = require('../models/Booking');

/**
 * سياسة الاسترداد الافتراضية
 * > 72 ساعة: 100%
 * بين 24 و 72 ساعة: 50%
 * < 24 ساعة: 0%
 */
function computeRefundAmount(booking) {
  const totalPaid = (booking.totalPrice || 0) + (booking.totalPriceReturn || 0);

  const flightDate = booking.flight?.date ? dayjs(booking.flight.date) : null;
  if (!flightDate) return 0;

  const now = dayjs();
  const diffHours = flightDate.diff(now, 'hour');

  if (diffHours >= 72) return totalPaid;
  if (diffHours >= 24) return Math.round(totalPaid * 0.5);
  return 0;
}

// إنشاء طلب استرداد
async function createRefundRequest(req, res) {
  try {
    const { bookingId, reason } = req.body;

    console.log('🟡 Received refund request for bookingId:', bookingId);
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required.' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('flight')
      .populate('returnFlight');

    if (!booking) {
      console.log('❌ Booking not found');
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      console.log('⛔ Unauthorized refund request by user:', req.user._id.toString());
      return res.status(403).json({ error: 'You do not have permission to refund this booking.' });
    }

    const existing = await RefundRequest.findOne({
      booking: booking._id,
      status: { $in: ['Pending', 'Approved', 'Processed'] },
    });

    if (existing) {
      console.log('⚠️ Duplicate refund request found:', existing._id.toString());
      return res.status(409).json({
        error: 'There is already a refund request for this booking.',
        requestId: existing._id,
      });
    }

    const totalPaid = (booking.totalPrice || 0) + (booking.totalPriceReturn || 0);
    const amount = computeRefundAmount(booking);

    const refundRequest = await RefundRequest.create({
      booking: booking._id,
      user: req.user._id,
      amount,
      reason: reason || 'No reason provided',
      status: 'Pending',
      isFullRefund: amount >= totalPaid,
    });

    console.log('✅ Refund request created:', refundRequest._id.toString());

    res.status(201).json({
      message: 'Refund request created successfully.',
      refundRequest,
    });

    try {
      booking.status = 'refund_pending';
      await booking.save();
    } catch (err) {
      console.error('⚠️ Failed to update booking status after refund:', err.message);
    }

  } catch (err) {
    console.error('❌ createRefundRequest error:', err);
    return res.status(500).json({ error: 'Failed to create refund request.' });
  }
}

// طلبات المستخدم
async function myRefundRequests(req, res) {
  try {
    const requests = await RefundRequest.find({ user: req.user._id })
      .populate({
        path: 'booking',
        populate: ['flight', 'returnFlight'],
      })
      .sort({ createdAt: -1 });

    return res.json(requests);
  } catch (err) {
    console.error('❌ myRefundRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch refund requests.' });
  }
}

// كل الطلبات (Admin)
async function listAllRefundRequests(req, res) {
  try {
    const requests = await RefundRequest.find()
      .populate({
        path: 'booking',
        populate: ['flight', 'returnFlight'],
      })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return res.json(requests);
  } catch (err) {
    console.error('❌ listAllRefundRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch refund requests.' });
  }
}

// تحديث الحالة (Admin)
async function updateRefundStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const validStatuses = ['Pending', 'Approved', 'Rejected', 'Processed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const refundRequest = await RefundRequest.findById(id).populate('booking');
    if (!refundRequest) {
      return res.status(404).json({ error: 'Refund request not found.' });
    }

    refundRequest.status = status || refundRequest.status;
    refundRequest.adminNote = adminNote || refundRequest.adminNote;
    await refundRequest.save();

    if (refundRequest.booking) {
      if (status === 'Approved') refundRequest.booking.status = 'refund_approved';
      else if (status === 'Rejected' && refundRequest.booking.status === 'refund_pending') refundRequest.booking.status = 'confirmed';
      else if (status === 'Processed') refundRequest.booking.status = 'refunded';

      try {
        await refundRequest.booking.save();
      } catch (err) {
        console.error('⚠️ Failed to update booking after refund status change:', err.message);
      }
    }

    return res.json({
      message: 'Refund request updated.',
      refundRequest,
    });

  } catch (err) {
    console.error('❌ updateRefundStatus error:', err);
    return res.status(500).json({ error: 'Failed to update refund request.' });
  }
}

// Webhook لاستخدام مستقبلي
async function handlePaymentWebhook(req, res) {
  try {
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ handlePaymentWebhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

module.exports = {
  createRefundRequest,
  myRefundRequests,
  listAllRefundRequests,
  updateRefundStatus,
  handlePaymentWebhook,
};