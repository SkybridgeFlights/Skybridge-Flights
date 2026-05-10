const axios = require('axios');
const analytics = require('./flightTrackerAnalytics');
const { getAirportByCode } = require('./flightTrackerData');

const PROVIDER = 'aerodatabox';
const DEFAULT_HOST = 'api.magicapi.dev';
const DEFAULT_PATH_PREFIX = '/api/v1/aedbx/aerodatabox';
const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = Number(process.env.AERODATABOX_CACHE_MS || 10 * 60_000);
const STALE_CACHE_TTL_MS = Number(process.env.AERODATABOX_STALE_CACHE_MS || 60 * 60_000);
const COOLDOWN_MS = Number(process.env.AERODATABOX_COOLDOWN_MS || 3000);
const REQUESTS_PER_MINUTE = Number(process.env.AERODATABOX_REQUESTS_PER_MINUTE || 20);

const cache = new Map();
const inFlight = new Map();
const cooldowns = new Map();
const budget = {
  windowStart: Date.now(),
  count: 0,
};

let lastError = '';
let lastFetchAt = 0;
let lastSuccessfulFetchAt = 0;

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return toIso(value.utc || value.local || value.scheduledTimeUtc || value.scheduledTimeLocal || value.time);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCode(value) {
  return safeText(value).toUpperCase();
}

function normalizeIdent(value) {
  return safeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeFlightNumber(value) {
  return safeText(value).toUpperCase().replace(/\s+/g, '');
}

function getConfig() {
  const key = safeText(
    process.env.AERODATABOX_API_KEY ||
    process.env.MAGICAPI_AERODATABOX_API_KEY ||
    process.env.API_MARKET_AERODATABOX_API_KEY
  );
  const host = safeText(process.env.AERODATABOX_API_HOST, DEFAULT_HOST).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const pathPrefix = safeText(process.env.AERODATABOX_API_PATH_PREFIX, DEFAULT_PATH_PREFIX).replace(/\/+$/, '');
  const authHeader = safeText(process.env.AERODATABOX_AUTH_HEADER, 'x-magicapi-key').toLowerCase();
  return {
    provider: PROVIDER,
    configured: !!key,
    hasCredentials: !!key,
    key,
    host,
    baseUrl: `https://${host}${pathPrefix}`,
    authHeader,
    cacheTtlMs: CACHE_TTL_MS,
    staleCacheTtlMs: STALE_CACHE_TTL_MS,
    cooldownMs: COOLDOWN_MS,
    requestsPerMinute: REQUESTS_PER_MINUTE,
  };
}

function authHeaders(config = getConfig()) {
  const headers = {
    accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (config.authHeader === 'authorization') {
    headers.Authorization = `Bearer ${config.key}`;
  } else {
    headers['x-magicapi-key'] = config.key;
  }
  return headers;
}

function log(event, fields = {}) {
  const clean = { provider: PROVIDER, ...fields };
  process.stdout.write(`[AERODATABOX] ${event} ${JSON.stringify(clean)}\n`);
}

function cacheKey(prefix, parts = {}) {
  return `${prefix}:${JSON.stringify(parts)}`;
}

function getFreshCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
  analytics.recordCacheHit(PROVIDER);
  log('cache_hit', { key, stale: false });
  return entry.payload;
}

function getStaleCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > STALE_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  analytics.recordCacheHit(PROVIDER, { stale: true });
  log('cache_hit', { key, stale: true });
  return { ...entry.payload, cached: true, stale: true };
}

function setCached(key, payload) {
  cache.set(key, { fetchedAt: Date.now(), payload });
}

function budgetSnapshot() {
  const now = Date.now();
  if (now - budget.windowStart >= 60_000) {
    budget.windowStart = now;
    budget.count = 0;
  }
  const limit = Math.max(1, REQUESTS_PER_MINUTE);
  return {
    limit,
    count: budget.count,
    remaining: Math.max(0, limit - budget.count),
    windowStartedAt: new Date(budget.windowStart).toISOString(),
    nextAvailableAt: budget.count >= limit ? new Date(budget.windowStart + 60_000).toISOString() : null,
  };
}

function consumeBudget() {
  const snap = budgetSnapshot();
  if (snap.remaining <= 0) return false;
  budget.count += 1;
  return true;
}

function unavailable(message, extra = {}) {
  return {
    available: false,
    provider: PROVIDER,
    error: message || 'AeroDataBox data is unavailable.',
    ...extra,
  };
}

async function withCache(key, work) {
  const fresh = getFreshCached(key);
  if (fresh) return fresh;

  if (inFlight.has(key)) {
    analytics.recordDedup(PROVIDER);
    log('dedupe', { key });
    return inFlight.get(key);
  }

  const nextAllowedAt = cooldowns.get(key) || 0;
  if (Date.now() < nextAllowedAt) {
    analytics.recordThrottle(PROVIDER);
    const stale = getStaleCached(key);
    if (stale) return stale;
    return unavailable('AeroDataBox request is cooling down.');
  }

  if (!consumeBudget()) {
    analytics.recordThrottle(PROVIDER);
    const stale = getStaleCached(key);
    if (stale) return stale;
    return unavailable('AeroDataBox request budget exhausted.', { rateLimited: true, budget: budgetSnapshot() });
  }

  const promise = (async () => {
    try {
      const payload = await work();
      setCached(key, payload);
      return payload;
    } catch (error) {
      analytics.recordFailure(PROVIDER, error);
      lastError = safeText(error?.message || 'AeroDataBox request failed.');
      cooldowns.set(key, Date.now() + COOLDOWN_MS);
      const stale = getStaleCached(key);
      if (stale) return stale;
      return unavailable(lastError, { httpStatus: error?.response?.status || null });
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

function selectSearchBy(query, context = {}) {
  const value = normalizeIdent(query);
  const live = context.liveAircraft || {};
  if (context.searchBy) return String(context.searchBy);
  if (/^[0-9a-f]{6}$/i.test(value)) return 'icao24';
  if (live.icao24 && normalizeIdent(live.icao24) === value) return 'icao24';
  if (live.registration && normalizeIdent(live.registration) === value) return 'reg';
  if (live.callsign && normalizeIdent(live.callsign) === value) return 'callsign';
  return /^[A-Z]{2,3}\d/.test(value) ? 'number' : 'callsign';
}

function airportCodeType(code = '') {
  return normalizeCode(code).length === 4 ? 'icao' : 'iata';
}

function buildAirportRef(value = {}, fallbackCode = '') {
  const code = normalizeCode(value.iata || value.iataCode || value.code || fallbackCode);
  const icaoCode = normalizeCode(value.icao || value.icaoCode || '');
  const airport = getAirportByCode(code) || getAirportByCode(icaoCode) || getAirportByCode(fallbackCode);
  const location = value.location || {};
  return {
    code: airport?.airportCode || code || null,
    icaoCode: airport?.icaoCode || icaoCode || null,
    name: safeText(value.name || value.shortName || value.fullName || value.airport || airport?.name || ''),
    city: safeText(value.municipalityName || value.city || airport?.city || ''),
    country: safeText(value.country?.name || value.country || airport?.country || ''),
    terminal: safeText(value.terminal || ''),
    gate: safeText(value.gate || ''),
    latitude: safeNumber(location.lat ?? location.latitude ?? value.latitude ?? airport?.latitude, null),
    longitude: safeNumber(location.lon ?? location.longitude ?? value.longitude ?? airport?.longitude, null),
  };
}

function normalizeMovement(movement = {}) {
  const airport = buildAirportRef(movement.airport || {}, movement.airport?.iata || movement.airport?.icao || '');
  return {
    airport,
    scheduledTime: toIso(movement.scheduledTime || movement.scheduled || movement.time),
    estimatedTime: toIso(movement.revisedTime || movement.predictedTime || movement.estimatedTime),
    actualTime: toIso(movement.actualTime || movement.runwayTime),
    terminal: safeText(movement.terminal || ''),
    gate: safeText(movement.gate || ''),
    baggageBelt: safeText(movement.baggageBelt || ''),
    delayMinutes: parseDelayMinutes(movement.scheduledTime, movement.revisedTime || movement.actualTime || movement.predictedTime),
  };
}

function parseDelayMinutes(scheduled, actual) {
  const s = toIso(scheduled);
  const a = toIso(actual);
  if (!s || !a) return null;
  const diff = Math.round((new Date(a).getTime() - new Date(s).getTime()) / 60_000);
  return Number.isFinite(diff) ? diff : null;
}

function parseDurationMinutes(value) {
  const text = safeText(value);
  const match = text.match(/(-)?(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const days = Number(match[2] || 0);
  const hours = Number(match[3] || 0);
  const minutes = Number(match[4] || 0);
  return (match[1] ? -1 : 1) * (days * 1440 + hours * 60 + minutes);
}

function distanceKm(distance = {}) {
  return safeNumber(distance.km ?? distance.kilometers ?? distance.valueKm ?? distance.value, null);
}

function confidenceForFlight(item = {}, query = '', context = {}) {
  const q = normalizeIdent(query);
  const live = context.liveAircraft || {};
  let score = 0.35;
  if (normalizeIdent(item.number) === q) score = Math.max(score, 0.96);
  if (normalizeIdent(item.callSign) === q) score = Math.max(score, 0.94);
  if (live.callsign && normalizeIdent(item.callSign) === normalizeIdent(live.callsign)) score = Math.max(score, 0.95);
  if (live.icao24 && normalizeIdent(item.aircraft?.modeS || item.aircraft?.hexIcao) === normalizeIdent(live.icao24)) score = Math.max(score, 0.92);
  if (live.registration && normalizeIdent(item.aircraft?.reg) === normalizeIdent(live.registration)) score = Math.max(score, 0.9);
  if (item.departure?.airport && item.arrival?.airport) score = Math.max(score, 0.75);
  return Math.round(score * 100) / 100;
}

function normalizeFlight(item = {}, query = '', context = {}) {
  const departure = normalizeMovement(item.departure || {});
  const arrival = normalizeMovement(item.arrival || {});
  const aircraft = item.aircraft || {};
  const airline = item.airline || {};
  const estimatedArrival = arrival.estimatedTime || arrival.actualTime || arrival.scheduledTime;
  const delayMinutes = arrival.delayMinutes ?? departure.delayMinutes ?? null;

  return {
    available: true,
    provider: PROVIDER,
    flightNumber: normalizeFlightNumber(item.number || query),
    callsign: safeText(item.callSign || ''),
    airline: safeText(airline.name || airline.iata || airline.icao || ''),
    airlineCode: safeText(airline.iata || airline.icao || ''),
    departureAirport: { ...departure.airport, terminal: departure.terminal, gate: departure.gate },
    arrivalAirport: { ...arrival.airport, terminal: arrival.terminal, gate: arrival.gate },
    scheduledDeparture: departure.scheduledTime,
    scheduledArrival: arrival.scheduledTime,
    estimatedArrival,
    actualDeparture: departure.actualTime,
    actualArrival: arrival.actualTime,
    status: safeText(item.status || 'unknown').toLowerCase(),
    delayMinutes,
    terminal: departure.terminal || arrival.terminal || null,
    gate: departure.gate || arrival.gate || null,
    aircraftType: safeText(aircraft.model || aircraft.modelCode || aircraft.icaoCode || aircraft.iataCode || ''),
    aircraftModel: safeText(aircraft.model || ''),
    registration: safeText(aircraft.reg || ''),
    icao24: safeText(aircraft.modeS || aircraft.hexIcao || '').toLowerCase(),
    distanceKm: distanceKm(item.greatCircleDistance),
    matchingConfidence: confidenceForFlight(item, query, context),
    rawStatusUpdatedAt: toIso(item.lastUpdatedUtc),
  };
}

function normalizeSearchResults(data = {}) {
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
  return items.map((item) => {
    if (typeof item === 'string') return { flightNumber: normalizeFlightNumber(item), label: item };
    return {
      flightNumber: normalizeFlightNumber(item.value || item.number || item.flightNumber || ''),
      label: safeText(item.text || item.label || item.value || item.number || ''),
    };
  }).filter((item) => item.flightNumber);
}

function normalizeAircraft(data = {}) {
  if (!data || Object.keys(data).length === 0) return null;
  return {
    provider: PROVIDER,
    registration: safeText(data.reg || ''),
    icao24: safeText(data.hexIcao || '').toLowerCase(),
    airline: safeText(data.airlineName || ''),
    aircraftType: safeText(data.model || data.modelCode || data.icaoCode || data.iataType || ''),
    aircraftModel: safeText(data.model || data.typeName || ''),
    aircraftTypeCode: safeText(data.icaoCode || data.iataCodeShort || ''),
    active: data.active ?? null,
    verified: data.verified ?? null,
  };
}

function normalizeAirport(data = {}) {
  if (!data || Object.keys(data).length === 0) return null;
  return buildAirportRef(data, data.iata || data.icao || '');
}

function normalizeRoute(data = {}) {
  if (!data || Object.keys(data).length === 0) return null;
  const from = buildAirportRef(data.from || {});
  const to = buildAirportRef(data.to || {});
  return {
    provider: PROVIDER,
    from,
    to,
    distanceKm: distanceKm(data.greatCircleDistance),
    durationMinutes: parseDurationMinutes(data.approxFlightTime),
    approximate: true,
  };
}

function normalizeResponse(type, data, context = {}) {
  if (type === 'search') return normalizeSearchResults(data);
  if (type === 'flight') {
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : data ? [data] : [];
    return items.map((item) => normalizeFlight(item, context.query, context));
  }
  if (type === 'aircraft') return normalizeAircraft(data);
  if (type === 'airport') return normalizeAirport(data);
  if (type === 'route') return normalizeRoute(data);
  return data;
}

function axiosError(error) {
  const status = error?.response?.status || null;
  const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Request failed';
  const wrapped = new Error(status ? `HTTP ${status}: ${message}` : message);
  wrapped.response = error?.response;
  return wrapped;
}

async function request(path, params = {}) {
  const config = getConfig();
  if (!config.configured) throw new Error('AERODATABOX_API_KEY is not set.');

  const url = `${config.baseUrl}${path}`;
  const startedAt = Date.now();
  lastFetchAt = Date.now();
  log('request', { url, params });
  try {
    const response = await axios.get(url, {
      timeout: DEFAULT_TIMEOUT_MS,
      headers: authHeaders(config),
      params,
    });
    lastSuccessfulFetchAt = Date.now();
    lastError = '';
    analytics.recordCall(PROVIDER, Date.now() - startedAt);
    log('response', { url, status: response.status, ms: Date.now() - startedAt });
    return response.data;
  } catch (error) {
    const wrapped = axiosError(error);
    log('failure', { url, status: error?.response?.status || null, message: wrapped.message });
    throw wrapped;
  }
}

async function searchFlight(query, options = {}) {
  const normalized = normalizeIdent(query);
  if (normalized.length < 2) return { available: false, provider: PROVIDER, results: [] };
  const key = cacheKey('searchFlight', { normalized, limit: options.limit || 8 });
  return withCache(key, async () => {
    const data = await request('/flights/search/term', { q: normalized, limit: options.limit || 8 });
    const results = normalizeResponse('search', data, { query: normalized });
    log('match_confidence', { query: normalized, matches: results.length, confidence: results.length ? 0.65 : 0 });
    return { available: results.length > 0, provider: PROVIDER, results, updatedAt: new Date().toISOString() };
  });
}

async function getFlightSchedule(query, context = {}) {
  const normalized = normalizeIdent(query);
  if (!normalized) return unavailable('Flight query is required.');
  const searchBy = selectSearchBy(normalized, context);
  const key = cacheKey('flightSchedule', { searchBy, normalized });
  return withCache(key, async () => {
    const data = await request(`/flights/${encodeURIComponent(searchBy)}/${encodeURIComponent(normalized)}`, {
      withAircraftImage: false,
      withLocation: false,
    });
    const flights = normalizeResponse('flight', data, { ...context, query: normalized });
    const best = flights.sort((a, b) => (b.matchingConfidence || 0) - (a.matchingConfidence || 0))[0] || null;
    log('match_confidence', { query: normalized, searchBy, confidence: best?.matchingConfidence || 0, matches: flights.length });
    return best || unavailable('No AeroDataBox flight schedule match was found.');
  });
}

async function getAirport(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return unavailable('Airport code is required.');
  const codeType = airportCodeType(normalized);
  const key = cacheKey('airport', { codeType, normalized });
  return withCache(key, async () => {
    const data = await request(`/airports/${codeType}/${encodeURIComponent(normalized)}`, {
      withRunways: false,
      withTime: false,
    });
    const airport = normalizeResponse('airport', data);
    return airport ? { available: true, provider: PROVIDER, ...airport } : unavailable('Airport not found.');
  });
}

async function getAircraft(query, context = {}) {
  const live = context.liveAircraft || {};
  const normalized = normalizeIdent(query || live.icao24 || live.registration || '');
  if (!normalized) return unavailable('Aircraft query is required.');
  const searchBy = /^[0-9a-f]{6}$/i.test(normalized) ? 'icao24' : 'reg';
  const key = cacheKey('aircraft', { searchBy, normalized });
  return withCache(key, async () => {
    const data = await request(`/aircrafts/${searchBy}/${encodeURIComponent(normalized)}`, {
      withImage: false,
      withRegistrations: false,
    });
    const aircraft = normalizeResponse('aircraft', data);
    return aircraft ? { available: true, ...aircraft } : unavailable('Aircraft not found.');
  });
}

async function getRoute(fromCode, toCode, options = {}) {
  const from = normalizeCode(fromCode);
  const to = normalizeCode(toCode);
  if (!from || !to) return unavailable('Both route airport codes are required.');
  const codeType = airportCodeType(from);
  const key = cacheKey('route', { codeType, from, to, aircraft: options.aircraftName || '' });
  return withCache(key, async () => {
    const data = await request(`/airports/${codeType}/${encodeURIComponent(from)}/distance-time/${encodeURIComponent(to)}`, {
      aircraftName: options.aircraftName || undefined,
      flightTimeModel: options.flightTimeModel || 'Standard',
    });
    const route = normalizeResponse('route', data);
    return route ? { available: true, ...route } : unavailable('Route not found.');
  });
}

function getProviderStatus() {
  const config = getConfig();
  return {
    provider: PROVIDER,
    gateway: 'api.market',
    host: config.host,
    configured: config.configured,
    hasCredentials: config.hasCredentials,
    authHeader: config.authHeader === 'authorization' ? 'Authorization' : 'x-magicapi-key',
    cacheEntries: cache.size,
    inFlightRequests: inFlight.size,
    cooldownEntries: cooldowns.size,
    cacheTtlMs: CACHE_TTL_MS,
    staleCacheTtlMs: STALE_CACHE_TTL_MS,
    cooldownMs: COOLDOWN_MS,
    budget: budgetSnapshot(),
    lastError: lastError || null,
    lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
    lastSuccessfulFetchAt: lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).toISOString() : null,
  };
}

module.exports = {
  searchFlight,
  getFlightSchedule,
  getAirport,
  getAircraft,
  getRoute,
  normalizeResponse,
  getProviderStatus,
  isConfigured() {
    return getConfig().configured;
  },
  __test: {
    normalizeFlight,
    normalizeAirport,
    normalizeAircraft,
    normalizeRoute,
    selectSearchBy,
    parseDurationMinutes,
  },
};
