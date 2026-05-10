const {
  getLiveAircraft,
  searchAircraft,
  getAircraftByIcao24,
  getAirportSnapshot,
  getFlightDetails,
  getFlightTrack,
  getHealth,
} = require('../services/flightTrackerProviderAggregator');
const { getTrackerSummary } = require('../services/flightTrackerService');
const { blogLog } = require('../services/blogLoggerService');

function sanitizeMessage(error) {
  return String(error?.message || 'Unexpected error')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://[redacted]');
}

function pickFilters(req = {}) {
  const query       = String(req.query?.query || req.query?.q || '').trim();
  const region      = String(req.query?.region || '').trim();
  const country     = String(req.query?.country || '').trim();
  const limit       = req.query?.limit;
  const minAltitude = req.query?.minAltitude;
  const maxAltitude = req.query?.maxAltitude;
  const minSpeed    = req.query?.minSpeed;
  const maxSpeed    = req.query?.maxSpeed;
  const airborneOnly  = req.query?.airborneOnly;
  const includeGround = req.query?.includeGround;

  // Bounding box from query params: lamin, lomin, lamax, lomax
  let bbox = null;
  const lamin = parseFloat(req.query?.lamin);
  const lomin = parseFloat(req.query?.lomin);
  const lamax = parseFloat(req.query?.lamax);
  const lomax = parseFloat(req.query?.lomax);
  if ([lamin, lomin, lamax, lomax].every(Number.isFinite)) {
    bbox = { lamin, lomin, lamax, lomax };
  }

  return {
    query, region, country, limit,
    minAltitude, maxAltitude, minSpeed, maxSpeed,
    airborneOnly, includeGround, bbox,
  };
}

function respondError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ success: false, message, ...extra });
}

// ── Existing handlers (now via aggregator) ────────────────────────────────────

exports.getLive = async (req, res) => {
  try {
    const filters = pickFilters(req);
    const payload = await getLiveAircraft(filters);
    blogLog('flight_tracker.live', {
      region: payload.region,
      returnedAircraft: payload.returnedAircraft,
      source: payload.source,
      throttled: !!payload.throttled,
      aggregator: payload.aggregator,
    });
    return res.json({
      success: true,
      ...payload,
      summary: payload.summary || getTrackerSummary(payload),
    });
  } catch (error) {
    blogLog('flight_tracker.live_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to load live flight tracker data.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.getAircraft = async (req, res) => {
  try {
    const icao24 = String(req.params.icao24 || '').trim().toLowerCase();
    if (!icao24) return respondError(res, 400, 'ICAO24 is required.');

    const payload = await getAircraftByIcao24(icao24, pickFilters(req));
    const found = !!payload.aircraft;
    blogLog('flight_tracker.aircraft', { icao24, found, source: payload.source });
    if (!found) {
      return respondError(res, 404, 'Aircraft not found in the current snapshot.', { icao24 });
    }
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.aircraft_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to load aircraft details.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.search = async (req, res) => {
  try {
    const query = String(req.query?.query || req.query?.q || '').trim();
    if (!query) {
      return respondError(res, 400, 'Search query is required.', {
        recommendedAction: 'Provide a callsign, flight number, airport code, or ICAO24 code.',
      });
    }
    const payload = await searchAircraft(query, pickFilters(req));
    blogLog('flight_tracker.search', {
      query,
      totalMatches: payload.totalMatches,
      source: payload.source,
      aggregator: payload.aggregator,
      commercialProvider: payload.commercial?.provider || null,
      hasRoute: !!payload.route,
      hasEta: !!payload.route?.remainingMinutes,
    });
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.search_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to search flights right now.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.getAirport = async (req, res) => {
  try {
    const airportCode = String(req.params.airportCode || '').trim().toUpperCase();
    if (!airportCode) return respondError(res, 400, 'Airport code is required.');

    const payload = await getAirportSnapshot(airportCode, pickFilters(req));
    blogLog('flight_tracker.airport', {
      airportCode,
      returnedAircraft: payload.returnedAircraft,
      source: payload.source,
    });
    if (!payload.airport) {
      return respondError(res, 404, 'Airport intelligence is not available for that code.', { airportCode });
    }
    return res.json({
      success: true,
      ...payload,
      summary: payload.summary || getTrackerSummary(payload),
    });
  } catch (error) {
    blogLog('flight_tracker.airport_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to load airport intelligence.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.getHealth = async (_req, res) => {
  try {
    const payload = await getHealth();
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.health_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 500, 'Unable to load flight tracker health.', {
      error: sanitizeMessage(error),
    });
  }
};

// ── New handlers ──────────────────────────────────────────────────────────────

exports.getFlightDetails = async (req, res) => {
  try {
    const flightId = String(req.params.flightId || req.query?.flightId || '').trim();
    if (!flightId) return respondError(res, 400, 'flightId is required.');

    const payload = await getFlightDetails(flightId);
    blogLog('flight_tracker.details', { flightId, available: !!payload.available, source: payload.source });
    if (!payload.available) {
      return respondError(res, 404, payload.error || 'Flight details are not available.', { flightId });
    }
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.details_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to load flight details.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.getFlightTrack = async (req, res) => {
  try {
    const flightId = String(req.params.flightId || req.query?.flightId || '').trim();
    if (!flightId) return respondError(res, 400, 'flightId is required.');

    const payload = await getFlightTrack(flightId);
    blogLog('flight_tracker.track', { flightId, available: !!payload.available, points: payload.points?.length });
    if (!payload.available) {
      return respondError(res, 404, payload.error || 'Flight track is not available.', { flightId });
    }
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.track_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 502, 'Unable to load flight track.', {
      error: sanitizeMessage(error),
    });
  }
};

exports.getProvidersHealth = async (_req, res) => {
  try {
    const payload = await getHealth();
    return res.json({ success: true, ...payload });
  } catch (error) {
    blogLog('flight_tracker.providers_health_failed', { message: sanitizeMessage(error) }, 'warn');
    return respondError(res, 500, 'Unable to load provider health.', {
      error: sanitizeMessage(error),
    });
  }
};
