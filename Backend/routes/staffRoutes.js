// routes/staffRoutes.js
const express = require('express');
const router = express.Router();
const {
  createStaff,
  listStaff,
  getStaffById,
  updateStaff,
  deleteStaff
} = require('../controllers/staffController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// اختبار صحة API
router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'Staff API is working!' });
});

// إضافة موظف جديد (Admin فقط)
router.post('/', protect, adminOnly, createStaff);

// عرض جميع الموظفين (Admin فقط)
router.get('/', protect, adminOnly, listStaff);

// عرض موظف محدد
router.get('/:id', protect, adminOnly, getStaffById);

// تعديل بيانات موظف
router.put('/:id', protect, adminOnly, updateStaff);

// حذف موظف
router.delete('/:id', protect, adminOnly, deleteStaff);

module.exports = router;