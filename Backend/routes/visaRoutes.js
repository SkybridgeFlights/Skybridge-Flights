// routes/visaRoutes.js
const express = require('express');
const router = express.Router();
const {
  createVisaApplication,
  listVisaApplications,
  updateVisaStatus,
  getVisaApplicationById,
  deleteVisaApplication
} = require('../controllers/visaController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// اختبار صحة API
router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'Visa API is working!' });
});

// إنشاء طلب فيزا جديد (يتطلب تسجيل الدخول)
router.post('/', protect, createVisaApplication);

// عرض جميع الطلبات (Admin فقط)
router.get('/', protect, adminOnly, listVisaApplications);

// عرض طلب فيزا محدد
router.get('/:id', protect, adminOnly, getVisaApplicationById);

// تحديث حالة الطلب (Admin فقط)
router.put('/:id', protect, adminOnly, updateVisaStatus);

// حذف طلب فيزا (Admin فقط)
router.delete('/:id', protect, adminOnly, deleteVisaApplication);

module.exports = router;