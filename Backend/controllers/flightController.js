const Flight = require('../models/Flight');
const { searchFlights } = require('../services/flightSearchService');

exports.searchFlights = async (req, res) => {
  try {
    const result = await searchFlights(req.query || {});
    return res.json(result);
  } catch (error) {
    console.error('Error in searchFlights:', error);

    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to fetch flights',
    });
  }
};

exports.getAllFlights = async (req, res) => {
  try {
    const flights = await Flight.find().sort({ date: 1, departureTime: 1 });
    return res.json(flights);
  } catch (error) {
    console.error('Error in getAllFlights:', error);
    return res.status(500).json({ error: 'Failed to fetch flights' });
  }
};

exports.getFlightById = async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id);
    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    return res.json(flight);
  } catch (error) {
    console.error('Error in getFlightById:', error);
    return res.status(500).json({ error: 'Failed to fetch flight' });
  }
};

exports.addFlight = async (req, res) => {
  try {
    const flight = await Flight.create(req.body);
    return res.status(201).json(flight);
  } catch (error) {
    console.error('Error in addFlight:', error);
    return res.status(500).json({ error: 'Failed to add flight' });
  }
};

exports.updateFlight = async (req, res) => {
  try {
    const flight = await Flight.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    return res.json(flight);
  } catch (error) {
    console.error('Error in updateFlight:', error);
    return res.status(500).json({ error: 'Failed to update flight' });
  }
};

exports.deleteFlight = async (req, res) => {
  try {
    const flight = await Flight.findByIdAndDelete(req.params.id);

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    return res.json({ message: 'Flight deleted successfully' });
  } catch (error) {
    console.error('Error in deleteFlight:', error);
    return res.status(500).json({ error: 'Failed to delete flight' });
  }
};
