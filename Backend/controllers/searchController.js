const Flight = require('../models/Flight');

// دالة لإزالة الأحرف الخاصة من الـ regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const searchFlights = async (req, res) => {
  try {
    const { from, to, date } = req.query;

    const query = {};

    if (from) {
      const fromRegex = new RegExp(escapeRegex(from), 'i');
      query.from = { $regex: fromRegex };
    }

    if (to) {
      const toRegex = new RegExp(escapeRegex(to), 'i');
      query.to = { $regex: toRegex };
    }

    if (date) {
      query.date = date;
    }

    const flights = await Flight.find(query);
    res.json(flights);
  } catch (err) {
    console.error('❌ Error in searchFlights:', err);
    res.status(500).json({ error: 'Server error while searching flights.' });
  }
};

module.exports = { searchFlights };