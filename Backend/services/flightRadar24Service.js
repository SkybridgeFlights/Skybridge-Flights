const axios = require('axios');
const analytics = require('./flightTrackerAnalytics');

const FR24_BASE = 'https://fr24api.flightradar24.com';

// ── Config ────────────────────────────────────────────────────────────────────

const BUDGET_PER_MINUTE = Number(process.env.FR24_REQUESTS_PER_MINUTE   || 6);
const LIVE_CACHE_MS     = Number(process.env.FR24_LIVE_CACHE_MS          || 60_000);  // 60 s — Explorer plan minimum
const DETAILS_CACHE_MS  = Number(process.env.FR24_DETAILS_CACHE_MS       || 300_000);
const TRACKS_CACHE_MS   = Number(process.env.FR24_TRACKS_CACHE_MS        || 300_000);
const STALE_CACHE_MS    = Number(process.env.FR24_STALE_CACHE_MS         || 300_000); // serve stale for this long when rate-limited
const FAILED_CACHE_MS   = Number(process.env.FR24_FAILED_LOOKUP_CACHE_MS || 300_000); // block retry after failure
const REQUEST_TIMEOUT   = 12_000;

// ── In-memory stores ──────────────────────────────────────────────────────────

const liveCache    = new Map();  // cacheKey → { payload, fetchedAt }
const detailsCache = new Map();
const tracksCache  = new Map();
const failedCache  = new Map();  // cacheKey → { reason, httpStatus, failedAt }
const inFlight     = new Map();  // cacheKey → Promise  (dedup simultaneous requests)

// ── Token-bucket budget (6 req/min default) ───────────────────────────────────

const budget = {
  windowStart: Date.now(),
  count: 0,
  _reset() {
    if (Date.now() - this.windowStart >= 60_000) {
      this.windowStart = Date.now();
      this.count = 0;
    }
  },
  consume() {
    this._reset();
    if (this.count >= BUDGET_PER_MINUTE) return false;
    this.count += 1;
    return true;
  },
  remaining() {
    this._reset();
    return Math.max(0, BUDGET_PER_MINUTE - this.count);
  },
  nextAvailableAt() {
    this._reset();
    if (this.remaining() > 0) return null;
    return new Date(this.windowStart + 60_000).toISOString();
  },
};

let lastError             = '';
let lastFetchAt           = 0;
let lastSuccessfulFetchAt = 0;

// ── Primitive helpers ─────────────────────────────────────────────────────────

function getApiKey()     { return String(process.env.FLIGHTRADAR24_API_KEY || '').trim(); }
function isConfigured()  { return !!getApiKey(); }
function nowIso()        { return new Date().toISOString(); }

function safeNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function safeStr(value, fallback = '') { return String(value ?? '').trim() || fallback; }

function authHeaders() {
  return {
    Authorization:   `Bearer ${getApiKey()}`,
    'Accept-Version': 'v1',
  };
}

/**
 * Convert internal bbox { lamin(S), lomin(W), lamax(N), lomax(E) }
 * to FR24 API bounds string "north,south,west,east".
 */
function toBoundsStr(bounds = {}) {
  const north = bounds.lamax ?? 90;
  const south = bounds.lamin ?? -90;
  const west  = bounds.lomin ?? -180;
  const east  = bounds.lomax ?? 180;
  return `${north},${south},${west},${east}`;
}

/**
 * A pure 6-character hex string is an OpenSky ICAO24 address — not a valid
 * FR24 flight ID. FR24 IDs are typically long hex strings or alphanumeric
 * callsign-style strings returned by the FR24 API.
 */
function looksLikeFr24Id(id = '') {
  const s = String(id || '').trim();
  if (!s) return false;
  return !/^[0-9a-f]{6}$/i.test(s);
}

function unavailable(message, httpStatus = null) {
  return { available: false, source: 'flightradar24', error: message, httpStatus };
}

function axiosError(error) {
  const status = error?.response?.status ?? null;
  const body   = error?.response?.data;
  let bodyMsg  = '';
  if (body && typeof body === 'object') {
    bodyMsg = String(body.message ?? body.error ?? body.detail ?? '');
    if (!bodyMsg) { try { bodyMsg = JSON.stringify(body).slice(0, 200); } catch (_) {} }
  } else if (typeof body === 'string') {
    bodyMsg = body.slice(0, 200);
  }
  const reason = bodyMsg || String(error?.message || 'Request failed');
  return { message: status ? `HTTP ${status}: ${reason}` : reason, httpStatus: status };
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Return a fresh cache entry (within TTL).
 * Does NOT delete stale entries — they stay for getStaleCached.
 */
function getCached(map, key, ttlMs) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) return null;  // stale but kept
  return { ...entry.payload, cacheHit: true };
}

/**
 * Return any stored cache entry regardless of age (stale-while-revalidate).
 * Used when budget is exhausted — better to serve old data than nothing.
 */
function getStaleCached(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  return { ...entry.payload, cacheHit: true, stale: true, staleMs: Date.now() - entry.fetchedAt };
}

function setCached(map, key, payload) {
  map.set(key, { fetchedAt: Date.now(), payload });
}

// ── Failed-lookup cache ───────────────────────────────────────────────────────

function getFailedLookup(key) {
  const entry = failedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.failedAt > FAILED_CACHE_MS) { failedCache.delete(key); return null; }
  return entry;
}

function setFailedLookup(key, reason, httpStatus = null) {
  failedCache.set(key, { reason, httpStatus, failedAt: Date.now() });
}

// ── Raw HTTP call ─────────────────────────────────────────────────────────────

async function fr24Get(path, params = {}) {
  const url = `${FR24_BASE}${path}`;
  lastFetchAt = Date.now();
  const { data } = await axios.get(url, {
    headers: { ...authHeaders(), Accept: 'application/json' },
    params,
    timeout: REQUEST_TIMEOUT,
  });
  lastSuccessfulFetchAt = Date.now();
  lastError = '';
  return data;
}

// ── Response normalizers ──────────────────────────────────────────────────────

/**
 * FR24 light/full position item → unified aircraft shape.
 * Unit conversions: alt ft→m, speed knots→m/s, vRate ft/min→m/s.
 */
function normalizeFr24LiveItem(item = {}) {
  const altFt    = safeNum(item.alt ?? item.altitude ?? item.baro_altitude, null);
  const altM     = altFt   !== null ? Math.round(altFt * 0.3048)              : null;
  const geoAltFt = safeNum(item.gnd_alt ?? item.geo_altitude, null);
  const geoAltM  = geoAltFt !== null ? Math.round(geoAltFt * 0.3048)         : null;
  const speedKts = safeNum(item.spd ?? item.gspeed ?? item.speed ?? item.ground_speed, null);
  const speedMs  = speedKts !== null ? Math.round(speedKts * 0.51444 * 10) / 10 : null;
  const vRateFpm = safeNum(item.vspd ?? item.vertical_speed ?? item.vertical_rate, null);
  const vRateMs  = vRateFpm !== null ? Math.round((vRateFpm * 0.00508) * 100) / 100 : null;

  return {
    // fr24FlightId: set when FR24 returns its own internal flight ID.
    // This is the ONLY field that qualifies for /flights/:id and /track/:id.
    fr24FlightId:  safeStr(item.fr24_id ?? item.fr24id ?? ''),
    icao24:        safeStr(item.hex ?? item.icao24 ?? item.icaoAddress ?? '').toLowerCase(),
    callsign:      safeStr(item.call ?? item.callsign ?? item.flight ?? '').replace(/\s+/g, '').toUpperCase() || '',
    flightNumber:  safeStr(item.flight ?? item.flight_number ?? item.flightNumber ?? ''),
    registration:  safeStr(item.reg ?? item.registration ?? ''),
    originCountry: safeStr(item.orig_country ?? item.country ?? item.origin_country ?? ''),
    latitude:      safeNum(item.lat ?? item.latitude, null),
    longitude:     safeNum(item.lon ?? item.lng ?? item.longitude, null),
    baroAltitude:  altM,
    geoAltitude:   geoAltM,
    velocity:      speedMs,
    trueTrack:     safeNum(item.track ?? item.heading ?? item.true_track, null),
    verticalRate:  vRateMs,
    onGround:      !!(item.gnd ?? item.on_ground ?? false),
    squawk:        safeStr(item.sqk ?? item.squawk ?? ''),
    category:      safeStr(item.type ?? item.category ?? 'unknown'),
    aircraftType:  safeStr(item.ac_type ?? item.aircraft_type ?? item.model ?? ''),
    airline:       safeStr(item.airline ?? item.op ?? ''),
    source:        'flightradar24',
    updatedAt:     nowIso(),
  };
}

function normalizeFr24DetailsItem(item = {}, flightId = '') {
  const dep = item.airport?.origin      ?? item.departure ?? item.dep ?? {};
  const arr = item.airport?.destination ?? item.arrival   ?? item.arr ?? {};

  function airportRef(obj) {
    return {
      code:      safeStr(obj.code?.iata ?? obj.iata ?? obj.iataCode ?? obj.code ?? ''),
      icaoCode:  safeStr(obj.code?.icao ?? obj.icao ?? obj.icaoCode ?? ''),
      name:      safeStr(obj.name ?? obj.airport ?? ''),
      city:      safeStr(obj.position?.region?.city ?? obj.city ?? ''),
      country:   safeStr(obj.position?.country?.name ?? obj.country ?? ''),
      terminal:  safeStr(obj.info?.terminal ?? obj.terminal ?? ''),
      gate:      safeStr(obj.info?.gate ?? obj.gate ?? ''),
      latitude:  safeNum(obj.position?.latitude  ?? obj.lat ?? obj.latitude,  null),
      longitude: safeNum(obj.position?.longitude ?? obj.lon ?? obj.longitude, null),
    };
  }

  const status = safeStr(item.status?.text ?? item.status ?? item.flight_status ?? 'unknown').toLowerCase();

  return {
    available:          true,
    source:             'flightradar24',
    flightId:           safeStr(item.identification?.id ?? item.flight_id ?? flightId),
    flightNumber:       safeStr(item.identification?.number?.default ?? item.flight_number ?? item.callsign ?? ''),
    callsign:           safeStr(item.identification?.callsign ?? item.callsign ?? ''),
    registration:       safeStr(item.aircraft?.registration ?? item.reg ?? ''),
    aircraftType:       safeStr(item.aircraft?.model?.code ?? item.ac_type ?? ''),
    aircraftModel:      safeStr(item.aircraft?.model?.text ?? ''),
    airline:            safeStr(item.airline?.name ?? item.operator ?? ''),
    airlineCode:        safeStr(item.airline?.code?.iata ?? item.airline?.iata ?? ''),
    departureAirport:   airportRef(dep),
    arrivalAirport:     airportRef(arr),
    scheduledDeparture: toIso(dep.time?.scheduled ?? dep.scheduled_time ?? dep.scheduledTime ?? null),
    scheduledArrival:   toIso(arr.time?.scheduled ?? arr.scheduled_time ?? arr.scheduledTime ?? null),
    estimatedArrival:   toIso(arr.time?.estimated ?? arr.estimated_time ?? arr.estimatedTime ?? null),
    actualDeparture:    toIso(dep.time?.real ?? dep.actual_time ?? dep.actualTime ?? null),
    actualArrival:      toIso(arr.time?.real ?? arr.actual_time ?? arr.actualTime ?? null),
    status,
    delayMinutes:       safeNum(item.status?.delay ?? item.delay_minutes ?? null, null),
    squawk:             safeStr(item.aircraft?.squawk ?? ''),
    updatedAt:          nowIso(),
  };
}

function normalizeFr24TrackPoint(point = {}) {
  const altFt  = safeNum(point.alt ?? point.altitude, null);
  const altM   = altFt  !== null ? Math.round(altFt * 0.3048)              : null;
  const spdKts = safeNum(point.spd ?? point.speed, null);
  const spdMs  = spdKts !== null ? Math.round(spdKts * 0.51444 * 10) / 10 : null;
  return {
    timestamp:  safeNum(point.ts ?? point.timestamp, null),
    latitude:   safeNum(point.lat ?? point.latitude, null),
    longitude:  safeNum(point.lon ?? point.lng ?? point.longitude, null),
    altitude:   altM,
    speed:      spdMs,
    heading:    safeNum(point.hd ?? point.track ?? point.heading, null),
    onGround:   !!(point.gnd ?? false),
  };
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'number' || /^\d{10,}$/.test(String(value))) {
    const d = new Date(Number(value) > 1e10 ? Number(value) : Number(value) * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Live positions ────────────────────────────────────────────────────────────

/**
 * Fetch live aircraft positions for a bounding box.
 * Strategy:
 *   1. Fresh cache  → return immediately, 0 budget consumed.
 *   2. In-flight    → join existing request, 0 extra budget consumed.
 *   3. Budget check → serve stale cache or rate-limit error.
 *   4. Fetch        → deduplicated, updates cache.
 */
async function getLivePositions(bounds = {}) {
  if (!isConfigured()) return unavailable('FLIGHTRADAR24_API_KEY is not set.');

  const cacheKey = `live:${JSON.stringify(bounds)}`;

  // 1. Fresh cache.
  const fresh = getCached(liveCache, cacheKey, LIVE_CACHE_MS);
  if (fresh) {
    analytics.recordCacheHit('flightradar24');
    return fresh;
  }

  // 2. In-flight dedup.
  if (inFlight.has(cacheKey)) {
    analytics.recordDedup('flightradar24');
    return inFlight.get(cacheKey);
  }

  // 3. Budget gate.
  if (!budget.consume()) {
    analytics.recordThrottle('flightradar24');
    const stale  = getStaleCached(liveCache, cacheKey);
    if (stale) analytics.recordCacheHit('flightradar24', { stale: true });
    const nextAt = budget.nextAvailableAt();
    if (stale) return { ...stale, rateLimited: true, nextAvailableAt: nextAt };
    return { ...unavailable('FR24 rate limit reached — try again shortly.'), rateLimited: true, nextAvailableAt: nextAt };
  }

  // 4. Fetch (deduplicated promise).
  const p = (async () => {
    try {
      const startedAt = Date.now();
      const boundsStr = toBoundsStr(bounds);
      process.stdout.write(
        `[FR24 SERVICE] getLivePositions bounds=${boundsStr} (budget=${budget.remaining()} remaining)\n`
      );

      const data = await fr24Get('/api/live/flight-positions/light', { bounds: boundsStr });
      analytics.recordCall('flightradar24', Date.now() - startedAt);

      // FR24 v1 light endpoint can return several shapes.
      let rawList;
      if      (Array.isArray(data))              rawList = data;
      else if (Array.isArray(data?.data))        rawList = data.data;
      else if (Array.isArray(data?.aircraft))    rawList = data.aircraft;
      else if (data?.data && typeof data.data === 'object')
        rawList = Object.values(data.data).filter(v => v && typeof v === 'object');
      else if (data && typeof data === 'object')
        rawList = Object.values(data).filter(v => v && typeof v === 'object' && (v.lat != null || v.latitude != null));
      else rawList = [];

      const aircraft = rawList.map(item => normalizeFr24LiveItem(item));
      const payload  = {
        available:     true,
        source:        'flightradar24',
        aircraft,
        totalAircraft: aircraft.length,
        rawCount:      rawList.length,
        updatedAt:     nowIso(),
      };
      setCached(liveCache, cacheKey, payload);
      return payload;
    } catch (error) {
      const { message, httpStatus } = axiosError(error);
      analytics.recordFailure('flightradar24', message);
      lastError = message;
      if ([400, 404, 422].includes(httpStatus)) setFailedLookup(cacheKey, message, httpStatus);
      return unavailable(lastError, httpStatus);
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, p);
  return p;
}

// ── Flight details ────────────────────────────────────────────────────────────

/**
 * Full flight details for a specific FR24 flight ID.
 * Only accepts IDs returned in the fr24FlightId field by getLivePositions.
 * Rejects ICAO24 hex addresses (6-char hex) and repeats failed lookups for 5 min.
 */
async function getFlightDetails(flightId = '') {
  const id = String(flightId || '').trim();
  if (!id) return unavailable('flightId is required.');

  if (!looksLikeFr24Id(id)) {
    return unavailable(
      `"${id}" looks like an ICAO24 hex address, not an FR24 flight ID. ` +
      'Use the fr24FlightId field from a live FR24 response.'
    );
  }

  if (!isConfigured()) return unavailable('FLIGHTRADAR24_API_KEY is not set.');

  const cacheKey = `details:${id}`;

  // Block repeated failed lookups.
  const failed = getFailedLookup(cacheKey);
  if (failed) {
    const remainMin = Math.max(1, Math.ceil((FAILED_CACHE_MS - (Date.now() - failed.failedAt)) / 60_000));
    return unavailable(
      `Previous request failed (${failed.reason}) — retry blocked for ${remainMin} min.`,
      failed.httpStatus
    );
  }

  const cached = getCached(detailsCache, cacheKey, DETAILS_CACHE_MS);
  if (cached) {
    analytics.recordCacheHit('flightradar24');
    return cached;
  }
  if (inFlight.has(cacheKey)) {
    analytics.recordDedup('flightradar24');
    return inFlight.get(cacheKey);
  }

  if (!budget.consume()) {
    analytics.recordThrottle('flightradar24');
    const stale = getStaleCached(detailsCache, cacheKey);
    if (stale) {
      analytics.recordCacheHit('flightradar24', { stale: true });
      return { ...stale, rateLimited: true };
    }
    return { ...unavailable('FR24 rate limit reached — try again shortly.'), rateLimited: true };
  }

  const promise = (async () => {
  try {
    const startedAt = Date.now();
    const data    = await fr24Get(`/api/flights/${encodeURIComponent(id)}`);
    analytics.recordCall('flightradar24', Date.now() - startedAt);
    const item    = data?.data ?? data?.flight ?? data ?? {};
    const payload = normalizeFr24DetailsItem(item, id);
    setCached(detailsCache, cacheKey, payload);
    return payload;
  } catch (error) {
    const { message, httpStatus } = axiosError(error);
    analytics.recordFailure('flightradar24', message);
    lastError = message;
    if ([400, 404, 422].includes(httpStatus)) setFailedLookup(cacheKey, message, httpStatus);
    return unavailable(lastError, httpStatus);
  }
  })().finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, promise);
  return promise;
}

// ── Flight track ──────────────────────────────────────────────────────────────

/**
 * Historical track for a specific FR24 flight ID.
 * Same eligibility rules as getFlightDetails.
 */
async function getFlightTrack(flightId = '') {
  const id = String(flightId || '').trim();
  if (!id) return unavailable('flightId is required.');

  if (!looksLikeFr24Id(id)) {
    return unavailable(
      `"${id}" looks like an ICAO24 hex address, not an FR24 flight ID. ` +
      'Use the fr24FlightId field from a live FR24 response.'
    );
  }

  if (!isConfigured()) return unavailable('FLIGHTRADAR24_API_KEY is not set.');

  const cacheKey = `track:${id}`;

  const failed = getFailedLookup(cacheKey);
  if (failed) {
    const remainMin = Math.max(1, Math.ceil((FAILED_CACHE_MS - (Date.now() - failed.failedAt)) / 60_000));
    return unavailable(
      `Previous request failed (${failed.reason}) — retry blocked for ${remainMin} min.`,
      failed.httpStatus
    );
  }

  const cached = getCached(tracksCache, cacheKey, TRACKS_CACHE_MS);
  if (cached) {
    analytics.recordCacheHit('flightradar24');
    return cached;
  }
  if (inFlight.has(cacheKey)) {
    analytics.recordDedup('flightradar24');
    return inFlight.get(cacheKey);
  }

  if (!budget.consume()) {
    analytics.recordThrottle('flightradar24');
    const stale = getStaleCached(tracksCache, cacheKey);
    if (stale) {
      analytics.recordCacheHit('flightradar24', { stale: true });
      return { ...stale, rateLimited: true };
    }
    return { ...unavailable('FR24 rate limit reached — try again shortly.'), rateLimited: true };
  }

  const promise = (async () => {
  try {
    const startedAt = Date.now();
    const data      = await fr24Get(`/api/flights/${encodeURIComponent(id)}/track`);
    analytics.recordCall('flightradar24', Date.now() - startedAt);
    const rawPoints = Array.isArray(data?.track) ? data.track
                    : Array.isArray(data?.data)  ? data.data
                    : Array.isArray(data)         ? data
                    : [];
    const points  = rawPoints.map(normalizeFr24TrackPoint).filter(p => p.latitude !== null);
    const payload = { available: true, source: 'flightradar24', flightId: id, points, updatedAt: nowIso() };
    setCached(tracksCache, cacheKey, payload);
    return payload;
  } catch (error) {
    const { message, httpStatus } = axiosError(error);
    analytics.recordFailure('flightradar24', message);
    lastError = message;
    if ([400, 404, 422].includes(httpStatus)) setFailedLookup(cacheKey, message, httpStatus);
    return unavailable(lastError, httpStatus);
  }
  })().finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, promise);
  return promise;
}

// ── Airport info ──────────────────────────────────────────────────────────────

async function getAirportInfo(airportCode = '') {
  const code = String(airportCode || '').trim().toUpperCase();
  if (!code) return unavailable('airportCode is required.');
  if (!isConfigured()) return unavailable('FLIGHTRADAR24_API_KEY is not set.');

  const cacheKey = `airport:${code}`;
  const cached   = getCached(detailsCache, cacheKey, DETAILS_CACHE_MS);
  if (cached) return cached;

  if (!budget.consume()) return unavailable('FR24 rate limit reached — try again shortly.');

  try {
    const data = await fr24Get(`/api/airports/${encodeURIComponent(code)}`);
    const item = data?.airport ?? data?.data ?? data ?? {};
    const pos  = item.position ?? {};
    const payload = {
      available: true, source: 'flightradar24',
      code:      safeStr(item.code?.iata ?? code),
      icaoCode:  safeStr(item.code?.icao ?? ''),
      name:      safeStr(item.name ?? ''),
      city:      safeStr(pos.region?.city ?? item.city ?? ''),
      country:   safeStr(pos.country?.name ?? item.country ?? ''),
      latitude:  safeNum(pos.latitude  ?? item.lat, null),
      longitude: safeNum(pos.longitude ?? item.lon, null),
      timezone:  safeStr(item.timezone?.name ?? ''),
      updatedAt: nowIso(),
    };
    setCached(detailsCache, cacheKey, payload);
    return payload;
  } catch (error) {
    const { message, httpStatus } = axiosError(error);
    lastError = message;
    return unavailable(lastError, httpStatus);
  }
}

// ── Airline info ──────────────────────────────────────────────────────────────

async function getAirlineInfo(airlineCode = '') {
  const code = String(airlineCode || '').trim().toUpperCase();
  if (!code) return unavailable('airlineCode is required.');
  if (!isConfigured()) return unavailable('FLIGHTRADAR24_API_KEY is not set.');

  const cacheKey = `airline:${code}`;
  const cached   = getCached(detailsCache, cacheKey, DETAILS_CACHE_MS);
  if (cached) return cached;

  if (!budget.consume()) return unavailable('FR24 rate limit reached — try again shortly.');

  try {
    const data = await fr24Get(`/api/airlines/${encodeURIComponent(code)}`);
    const item = data?.airline ?? data?.data ?? data ?? {};
    const payload = {
      available: true, source: 'flightradar24',
      code:      safeStr(item.code?.iata ?? code),
      icaoCode:  safeStr(item.code?.icao ?? ''),
      name:      safeStr(item.name ?? ''),
      country:   safeStr(item.country ?? ''),
      updatedAt: nowIso(),
    };
    setCached(detailsCache, cacheKey, payload);
    return payload;
  } catch (error) {
    const { message, httpStatus } = axiosError(error);
    lastError = message;
    return unavailable(lastError, httpStatus);
  }
}

// ── Provider status ───────────────────────────────────────────────────────────

function getProviderStatus() {
  const rem   = budget.remaining();
  const nextAt = rem > 0 ? null : budget.nextAvailableAt();
  return {
    provider:              'flightradar24',
    configured:            isConfigured(),
    hasCredentials:        isConfigured(),
    budgetPerMinute:       BUDGET_PER_MINUTE,
    budgetRemaining:       rem,
    budgetNextAvailableAt: nextAt,
    liveCacheMs:           LIVE_CACHE_MS,
    staleCacheMs:          STALE_CACHE_MS,
    failedCacheMs:         FAILED_CACHE_MS,
    detailsCacheMs:        DETAILS_CACHE_MS,
    tracksCacheMs:         TRACKS_CACHE_MS,
    liveCacheEntries:      liveCache.size,
    detailsCacheEntries:   detailsCache.size,
    tracksCacheEntries:    tracksCache.size,
    failedLookupEntries:   failedCache.size,
    inFlightRequests:      inFlight.size,
    lastError:             lastError || null,
    lastFetchAt:           lastFetchAt           ? new Date(lastFetchAt).toISOString()           : null,
    lastSuccessfulFetchAt: lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).toISOString() : null,
    explorerPlanNote:      `Max ${BUDGET_PER_MINUTE} req/min. Live cache: ${LIVE_CACHE_MS}ms. Stale grace: ${STALE_CACHE_MS}ms.`,
  };
}

module.exports = {
  getLivePositions,
  getFlightDetails,
  getFlightTrack,
  getAirportInfo,
  getAirlineInfo,
  getProviderStatus,
  isConfigured,
  __test: {
    normalizeFr24LiveItem,
    normalizeFr24DetailsItem,
    normalizeFr24TrackPoint,
    toBoundsStr,
    looksLikeFr24Id,
  },
};
