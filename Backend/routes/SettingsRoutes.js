const express = require('express');
const router = express.Router();

const {
  getBookingSettings,
  updateBookingSettings,
} = require('../controllers/SettingsController');

const { protect, requirePerm } = require('../middleware/authMiddleware');

router.get('/booking', getBookingSettings);
router.put('/booking', protect, requirePerm('manageSettings'), updateBookingSettings);

module.exports = router;