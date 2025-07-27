// controllers/staffController.js
const Staff = require('../models/Staff');

// @desc    إنشاء موظف جديد
// @route   POST /api/staff
exports.createStaff = async (req, res) => {
  try {
    const { name, role, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const existing = await Staff.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Staff member with this email already exists.' });
    }

    const staff = await Staff.create({ name, role, email, phone });
    return res.status(201).json({ message: 'Staff created successfully.', staff });
  } catch (error) {
    console.error('CreateStaff Error:', error);
    return res.status(500).json({ error: 'Failed to create staff member', details: error.message });
  }
};

// @desc    عرض جميع الموظفين
// @route   GET /api/staff
exports.listStaff = async (req, res) => {
  try {
    const staff = await Staff.find().sort({ createdAt: -1 });
    return res.json(staff);
  } catch (error) {
    console.error('ListStaff Error:', error);
    return res.status(500).json({ error: 'Failed to fetch staff members', details: error.message });
  }
};

// @desc    عرض موظف محدد
// @route   GET /api/staff/:id
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    return res.json(staff);
  } catch (error) {
    console.error('GetStaffById Error:', error);
    return res.status(500).json({ error: 'Failed to fetch staff member', details: error.message });
  }
};

// @desc    تحديث بيانات موظف
// @route   PUT /api/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    return res.json({ message: 'Staff updated successfully.', staff });
  } catch (error) {
    console.error('UpdateStaff Error:', error);
    return res.status(500).json({ error: 'Failed to update staff member', details: error.message });
  }
};

// @desc    حذف موظف
// @route   DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    return res.json({ message: 'Staff deleted successfully.' });
  } catch (error) {
    console.error('DeleteStaff Error:', error);
    return res.status(500).json({ error: 'Failed to delete staff member', details: error.message });
  }
};