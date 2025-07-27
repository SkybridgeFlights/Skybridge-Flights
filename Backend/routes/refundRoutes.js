// routes/refundRoutes.js
const express = require('express');
const router = express.Router();

const {
  createRefundRequest,
  myRefundRequests,
  listAllRefundRequests,
  updateRefundStatus,
} = require('../controllers/refundController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

/**
 * @route POST /api/refunds
 * @desc إنشاء طلب استرداد جديد
 * @access Private (User)
 */
router.post('/', protect, createRefundRequest);

/**
 * @route GET /api/refunds/mine
 * @desc جلب طلبات الاسترداد الخاصة بالمستخدم الحالي
 * @access Private (User)
 */
router.get('/mine', protect, myRefundRequests);

/**
 * @route GET /api/refunds
 * @desc جلب جميع طلبات الاسترداد (Admin فقط)
 * @access Private/Admin
 */
router.get('/', protect, adminOnly, listAllRefundRequests);

/**
 * @route PATCH /api/refunds/:id/status
 * @desc تحديث حالة طلب الاسترداد (Approve / Reject / Process)
 * @access Private/Admin
 */
router.patch('/:id/status', protect, adminOnly, updateRefundStatus);

module.exports = router;