// controllers/visaController.js
const VisaApplication = require('../models/VisaApplication');

// @desc    إنشاء طلب فيزا جديد
// @route   POST /api/visa
exports.createVisaApplication = async (req, res) => {
  try {
    const { fullName, passportNumber, country, notes } = req.body;

    if (!fullName || !passportNumber || !country) {
      return res.status(400).json({ error: 'Full name, passport number, and country are required.' });
    }

    const visa = await VisaApplication.create({
      user: req.user._id,
      fullName,
      passportNumber,
      country,
      notes
    });

    return res.status(201).json({ message: 'Visa application created successfully.', visa });
  } catch (error) {
    console.error('CreateVisa Error:', error);
    return res.status(500).json({ error: 'Failed to create visa application', details: error.message });
  }
};

// @desc    عرض جميع طلبات الفيزا
// @route   GET /api/visa
exports.listVisaApplications = async (req, res) => {
  try {
    const visas = await VisaApplication.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return res.json(visas);
  } catch (error) {
    console.error('ListVisas Error:', error);
    return res.status(500).json({ error: 'Failed to fetch visa applications', details: error.message });
  }
};

// @desc    عرض طلب فيزا محدد
// @route   GET /api/visa/:id
exports.getVisaApplicationById = async (req, res) => {
  try {
    const visa = await VisaApplication.findById(req.params.id)
      .populate('user', 'name email');
    if (!visa) return res.status(404).json({ error: 'Visa application not found.' });

    return res.json(visa);
  } catch (error) {
    console.error('GetVisaById Error:', error);
    return res.status(500).json({ error: 'Failed to fetch visa application', details: error.message });
  }
};

// @desc    تحديث حالة طلب الفيزا
// @route   PUT /api/visa/:id
exports.updateVisaStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, approved, or rejected.' });
    }

    const visa = await VisaApplication.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    );
    if (!visa) return res.status(404).json({ error: 'Visa application not found.' });

    return res.json({ message: 'Visa application updated successfully.', visa });
  } catch (error) {
    console.error('UpdateVisa Error:', error);
    return res.status(500).json({ error: 'Failed to update visa application', details: error.message });
  }
};

// @desc    حذف طلب فيزا
// @route   DELETE /api/visa/:id
exports.deleteVisaApplication = async (req, res) => {
  try {
    const visa = await VisaApplication.findByIdAndDelete(req.params.id);
    if (!visa) return res.status(404).json({ error: 'Visa application not found.' });

    return res.json({ message: 'Visa application deleted successfully.' });
  } catch (error) {
    console.error('DeleteVisa Error:', error);
    return res.status(500).json({ error: 'Failed to delete visa application', details: error.message });
  }
};