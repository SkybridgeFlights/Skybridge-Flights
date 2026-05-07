const express = require('express');
const router = express.Router();

const {
  searchFlights,
  getAllFlights,
  getFlightById,
  addFlight,
  updateFlight,
  deleteFlight,
} = require('../controllers/flightController');

router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'Flight API is working!' });
});

router.get('/search', searchFlights);

router.get('/', getAllFlights);
router.get('/:id', getFlightById);
router.post('/', addFlight);
router.put('/:id', updateFlight);
router.delete('/:id', deleteFlight);

module.exports = router;