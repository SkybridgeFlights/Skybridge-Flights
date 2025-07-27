const Flight = require('../models/Flight');

// --- Helper: Normalize date to YYYY-MM-DD ---
function normalizeDate(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

// --- Search Flights (One-way or Round-trip) ---
exports.searchFlights = async (req, res) => {
  try {
    const { from, to, date, returnDate } = req.query;

    if (!from || !to || !date) {
      return res.status(400).json({ error: 'From, To and Departure Date are required' });
    }

    const departureDate = normalizeDate(date);
    console.log('🔍 Search Request:', { from, to, date: departureDate, returnDate });

    // --- البحث عن رحلات الذهاب ---
    const outboundFlights = await Flight.find({
      from,
      to,
      date: departureDate,
    });

    console.log(`➡️ Outbound flights found: ${outboundFlights.length}`);

    // --- البحث عن رحلات الإياب ---
    let returnFlights = [];
    if (returnDate) {
      const returnDateNorm = normalizeDate(returnDate);
      returnFlights = await Flight.find({
        from: to,
        to: from,
        date: returnDateNorm,
      });
      console.log(`↩️ Return flights found: ${returnFlights.length}`);
    }

    if (outboundFlights.length === 0 && returnFlights.length === 0) {
      return res.status(404).json({ error: 'No flights found for the selected dates.' });
    }

    return res.json({
      outboundFlights,
      returnFlights,
    });
  } catch (error) {
    console.error('Error in searchFlights:', error);
    return res.status(500).json({ error: 'Failed to fetch flights', details: error.message });
  }
};

// --- Get All Flights ---
exports.getAllFlights = async (req, res) => {
  try {
    const flights = await Flight.find().sort({ date: 1 });
    return res.json(flights);
  } catch (error) {
    console.error('Error in getAllFlights:', error);
    return res.status(500).json({ error: 'Failed to fetch flights' });
  }
};

// --- Get Flight By ID ---
exports.getFlightById = async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id);
    if (!flight) return res.status(404).json({ error: 'Flight not found' });
    return res.json(flight);
  } catch (error) {
    console.error('Error in getFlightById:', error);
    return res.status(500).json({ error: 'Failed to fetch flight' });
  }
};

// --- Add Flight ---
exports.addFlight = async (req, res) => {
  try {
    const flight = await Flight.create(req.body);
    return res.status(201).json(flight);
  } catch (error) {
    console.error('Error in addFlight:', error);
    return res.status(500).json({ error: 'Failed to add flight' });
  }
};

// --- Update Flight ---
exports.updateFlight = async (req, res) => {
  try {
    const flight = await Flight.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!flight) return res.status(404).json({ error: 'Flight not found' });
    return res.json(flight);
  } catch (error) {
    console.error('Error in updateFlight:', error);
    return res.status(500).json({ error: 'Failed to update flight' });
  }
};

// --- Delete Flight ---
exports.deleteFlight = async (req, res) => {
  try {
    const flight = await Flight.findByIdAndDelete(req.params.id);
    if (!flight) return res.status(404).json({ error: 'Flight not found' });
    return res.json({ message: 'Flight deleted successfully' });
  } catch (error) {
    console.error('Error in deleteFlight:', error);
    return res.status(500).json({ error: 'Failed to delete flight' });
  }
};