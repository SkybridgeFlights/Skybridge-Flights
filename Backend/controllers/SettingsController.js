const BookingSettings = require('../models/bookingSettingsModel');

const getBookingSettings = async (req, res) => {
  try {
    let settings = await BookingSettings.findOne({});

    if (!settings) {
      settings = await BookingSettings.create({});
    }

    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateBookingSettings = async (req, res) => {
  try {
    let settings = await BookingSettings.findOne({});

    if (!settings) {
      settings = new BookingSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }

    await settings.save();

    res.json(settings);
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getBookingSettings,
  updateBookingSettings,
};