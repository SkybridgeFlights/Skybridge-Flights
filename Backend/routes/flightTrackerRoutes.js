const express = require('express');
const router = express.Router();

const {
  getAirport,
  getAircraft,
  getHealth,
  getLive,
  search,
  getFlightDetails,
  getFlightTrack,
  getProvidersHealth,
} = require('../controllers/flightTrackerController');

router.get('/health',               getHealth);
router.get('/providers/health',     getProvidersHealth);
router.get('/live',                 getLive);
router.get('/search',               search);
router.get('/details',              search);   // alias for backward-compat
router.get('/enrich',               search);   // alias for backward-compat
router.get('/aircraft/:icao24',     getAircraft);
router.get('/airport/:airportCode', getAirport);
router.get('/flights/:flightId',    getFlightDetails);
router.get('/track/:flightId',      getFlightTrack);

module.exports = router;
