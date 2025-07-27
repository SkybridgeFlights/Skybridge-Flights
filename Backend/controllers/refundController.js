// controllers/refundController.js
const dayjs = require('dayjs');
const RefundRequest = require('../models/RefundRequest');
const Booking = require('../models/Booking');

/**
 * سياسة الاسترداد الافتراضية (يمكنك لاحقاً جلبها من DB/لوحة الأدمن)
 * - >72 ساعة: 100%
 * - بين 24 و 72: 50%
 * - <24 ساعة: 0%
 */
function computeRefundAmount(booking) {
  const totalPaid =
    (booking.totalPrice || 0) + (booking.totalPriceReturn || 0);

  // لو لم يكن لدينا موعد رحلة، أعد 0 (أو كامل المبلغ كما تريد)
  const flightDate = booking.flight?.date ? dayjs(booking.flight.date) : null;
  if (!flightDate) return 0;

  const now = dayjs();
  const diffHours = flightDate.diff(now, 'hour');

  if (diffHours >= 72) return totalPaid;                // 100%
  if (diffHours >= 24) return Math.round(totalPaid * 0.5); // 50%
  return 0; // أقل من 24 ساعة
}

/**
 * POST /api/refunds
 * إنشاء طلب استرداد جديد
 */
async function createRefundRequest(req, res) {
  try {
    const { bookingId, reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required.' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('flight')
      .populate('returnFlight');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // التحقق من الملكية (إلا لو كان أدمن)
    if (!req.user.isAdmin && booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You do not have permission to refund this booking.' });
    }

    // منع الطلبات المكررة لنفس الحجز (إلا لو كان الطلب السابق مرفوض)
    const existing = await RefundRequest.findOne({
      booking: booking._id,
      status: { $in: ['Pending', 'Approved', 'Processed'] },
    });
    if (existing) {
      return res.status(409).json({
        error: 'There is already a refund request for this booking.',
        requestId: existing._id,
      });
    }

    const amount = computeRefundAmount(booking);

    const refundRequest = await RefundRequest.create({
      booking: booking._id,
      user: req.user._id,
      amount,
      reason: reason || 'No reason provided',
      status: 'Pending',
      isFullRefund: amount >= ((booking.totalPrice || 0) + (booking.totalPriceReturn || 0)),
    });

    // حدّث حالة الحجز إلى refund_pending (اختياري)
    booking.status = 'refund_pending';
    await booking.save();

    return res.status(201).json({
      message: 'Refund request created successfully.',
      refundRequest,
    });
  } catch (err) {
    console.error('createRefundRequest error:', err);
    return res.status(500).json({ error: 'Failed to create refund request.' });
  }
}

/**
 * GET /api/refunds/mine
 * طلبات الاسترداد الخاصة بالمستخدم الحالي
 */
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
    console.error('myRefundRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch refund requests.' });
  }
}

/**
 * GET /api/refunds
 * جميع طلبات الاسترداد (للمشرف)
 */
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
    console.error('listAllRefundRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch refund requests.' });
  }
}

/**
 * PATCH /api/refunds/:id/status
 * تحديث حالة طلب الاسترداد (أدمن فقط)
 * statuses: Pending -> Approved / Rejected -> Processed
 */
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

    // تحديث حالة الحجز بما يتوافق مع حالة طلب الاسترداد
    if (refundRequest.booking) {
      if (refundRequest.status === 'Approved') {
        refundRequest.booking.status = 'refund_approved';
      } else if (refundRequest.status === 'Rejected') {
        // في حال الرفض، أعد حالة الحجز لما كانت عليه (confirmed غالباً)
        if (refundRequest.booking.status === 'refund_pending') {
          refundRequest.booking.status = 'confirmed';
        }
      } else if (refundRequest.status === 'Processed') {
        refundRequest.booking.status = 'refunded';
      }
      await refundRequest.booking.save();
    }

    return res.json({
      message: 'Refund request updated.',
      refundRequest,
    });
  } catch (err) {
    console.error('updateRefundStatus error:', err);
    return res.status(500).json({ error: 'Failed to update refund request.' });
  }
}

/**
 * (اختياري) Webhook لاستلام إشعار الدفع/الاسترداد من مزود الدفع (Stripe, Adyen, Kiwi ...)
 * يمكنك تفعيله لاحقاً وربطه بعملية updateRefundStatus تلقائياً.
 */
async function handlePaymentWebhook(req, res) {
  try {
    // TODO: تحقق من التوقيع/المصدر
    // const event = req.body;

    // مثال: event.type === 'refund.processed'
    // ابحث عن الطلب ثم حدث حالته إلى "Processed"
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('handlePaymentWebhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

module.exports = {
  createRefundRequest,
  myRefundRequests,
  listAllRefundRequests,
  updateRefundStatus,
  handlePaymentWebhook, // لو أحببت إضافته للراوتر لاحقاً
};