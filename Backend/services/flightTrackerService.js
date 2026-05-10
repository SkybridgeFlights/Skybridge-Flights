const axios = require('axios');
const {
  REGION_LABELS,
  getAirportByCode,
  getAirportCodes,
  getRegionBounds,
  getRegionCenter,
} = require('./flightTrackerData');
const {
  buildCommercialRoute,
  getCommercialProviderStatus,
  lookupCommercialAirportSchedule,
  lookupCommercialFlight,
} = require('./flightTrackerCommercialService');
const analytics = require('./flightTrackerAnalytics');

const OPEN_SKY_BASE = 'https://opensky-network.org/api';
const OPEN_SKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

const DEFAULT_CONFIG = {
  enabled: process.env.FLIGHT_TRACKER_ENABLED !== 'false',
  cacheDurationMs: Number(process.env.FLIGHT_TRACKER_CACHE_MS || 60_000),
  staleCacheDurationMs: Number(process.env.FLIGHT_TRACKER_STALE_CACHE_MS || 5 * 60_000),
  maxAircraftReturned: Number(process.env.FLIGHT_TRACKER_MAX_AIRCRAFT || 2500),
  maxAircraftHardLimit: Number(process.env.FLIGHT_TRACKER_MAX_AIRCRAFT_HARD_LIMIT || 10_000),
  rateLimitPerMinute: Number(process.env.FLIGHT_TRACKER_RATE_LIMIT_PER_MINUTE || 30),
  defaultRegion: (process.env.FLIGHT_TRACKER_DEFAULT_REGION || 'global').toLowerCase(),
  enabledRegions: (process.env.FLIGHT_TRACKER_ENABLED_REGIONS || 'global,germany,europe,turkey,middle-east,asia,africa,north_america,south_america,oceania')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  showCta: process.env.FLIGHT_TRACKER_SHOW_CTA !== 'false',
};

const cache = new Map();
const inFlight = new Map();
const requestWindow = {
  startedAt: Date.now(),
  count: 0,
  blockedAt: null,
};
let tokenState = {
  token: null,
  expiresAt: 0,
  mode: 'anonymous',
};
let lastFetchAt = 0;
let lastSuccessfulFetchAt = 0;
let lastError = '';
let mockState = null;

function safeInt(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeCallsign(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCategory(value) {
  const map = {
    0: 'unknown',
    1: 'no-emitter-category',
    2: 'light',
    3: 'small',
    4: 'large',
    5: 'high-vortex-large',
    6: 'heavy',
    7: 'high-performance',
    8: 'rotorcraft',
    9: 'glider',
    10: 'lighter-than-air',
    11: 'parachutist',
    12: 'ultralight',
    13: 'reserved',
    14: 'uav',
    15: 'space',
    16: 'surface-emergency',
    17: 'surface-service',
    18: 'point-obstacle',
    19: 'cluster-obstacle',
    20: 'line-obstacle',
  };
  return map[safeInt(value, 0)] || 'unknown';
}

function normalizeState(state, source = 'opensky-anonymous') {
  const [
    icao24,
    callsign,
    origin_country,
    time_position,
    last_contact,
    longitude,
    latitude,
    baro_altitude,
    on_ground,
    velocity,
    true_track,
    vertical_rate,
    _sensors,
    geo_altitude,
    squawk,
    _spi,
    _position_source,
    category,
  ] = state || [];

  return {
    icao24: String(icao24 || '').toLowerCase(),
    callsign: sanitizeCallsign(callsign),
    originCountry: String(origin_country || ''),
    longitude: safeInt(longitude, null),
    latitude: safeInt(latitude, null),
    baroAltitude: safeInt(baro_altitude, null),
    velocity: safeInt(velocity, null),
    trueTrack: safeInt(true_track, null),
    verticalRate: safeInt(vertical_rate, null),
    onGround: !!on_ground,
    lastContact: safeInt(last_contact || time_position, null),
    geoAltitude: safeInt(geo_altitude, null),
    squawk: String(squawk || '').trim(),
    category: normalizeCategory(category),
    source,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeResponse(response, source = 'opensky-anonymous') {
  const states = Array.isArray(response?.states) ? response.states : [];
  return {
    time: safeInt(response?.time, Math.floor(Date.now() / 1000)),
    source,
    aircraft: states.map((state) => normalizeState(state, source)),
  };
}

function buildCacheKey(params = {}) {
  return JSON.stringify({
    airportCode: params.airportCode || '',
    query: String(params.query || '').toLowerCase().trim(),
    region: String(params.region || '').toLowerCase().trim(),
    limit: Number(params.limit || 0),
    includeGround: !!params.includeGround,
    airborneOnly: !!params.airborneOnly,
    country: String(params.country || '').toLowerCase().trim(),
    minAltitude: params.minAltitude ?? '',
    maxAltitude: params.maxAltitude ?? '',
    minSpeed: params.minSpeed ?? '',
    maxSpeed: params.maxSpeed ?? '',
  });
}

function parseBoundingBox(bbox = {}) {
  if (!bbox) return null;
  const lamin = safeInt(bbox.lamin, null);
  const lomin = safeInt(bbox.lomin, null);
  const lamax = safeInt(bbox.lamax, null);
  const lomax = safeInt(bbox.lomax, null);
  if ([lamin, lomin, lamax, lomax].some((item) => item === null)) return null;
  return { lamin, lomin, lamax, lomax };
}

function buildAirportBounds(airport) {
  if (!airport) return null;
  const latitude = safeInt(airport.latitude, 0);
  const longitude = safeInt(airport.longitude, 0);
  const radiusKm = safeInt(airport.radiusKm, 50);
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)));
  return {
    lamin: latitude - latDelta,
    lomin: longitude - lonDelta,
    lamax: latitude + latDelta,
    lomax: longitude + lonDelta,
  };
}

function matchesAirportBounds(state, bounds) {
  if (!bounds || state.latitude === null || state.longitude === null) return false;
  return (
    state.latitude >= bounds.lamin &&
    state.latitude <= bounds.lamax &&
    state.longitude >= bounds.lomin &&
    state.longitude <= bounds.lomax
  );
}

function containsQuery(state, query) {
  const needle = String(query || '').toLowerCase().trim();
  if (!needle) return true;
  const haystack = [
    state.icao24,
    state.callsign,
    state.originCountry,
    state.squawk,
    String(state.category || ''),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function numericWithin(value, min, max) {
  if (value === null || value === undefined) return true;
  if (min !== null && min !== undefined && value < min) return false;
  if (max !== null && max !== undefined && value > max) return false;
  return true;
}

function filterAircraft(aircraft = [], params = {}) {
  const query = String(params.query || '').trim();
  const country = String(params.country || '').trim().toLowerCase();
  const airborneOnly = params.airborneOnly === true || params.airborneOnly === 'true';
  const includeGround = params.includeGround === true || params.includeGround === 'true';
  const minAltitude = safeInt(params.minAltitude, null);
  const maxAltitude = safeInt(params.maxAltitude, null);
  const minSpeed = safeInt(params.minSpeed, null);
  const maxSpeed = safeInt(params.maxSpeed, null);

  return aircraft.filter((item) => {
    if (!includeGround && item.onGround) return false;
    if (airborneOnly && item.onGround) return false;
    if (country && !String(item.originCountry || '').toLowerCase().includes(country)) return false;
    if (!containsQuery(item, query)) return false;
    if (!numericWithin(item.geoAltitude ?? item.baroAltitude, minAltitude, maxAltitude)) return false;
    if (!numericWithin(item.velocity, minSpeed, maxSpeed)) return false;
    return true;
  });
}

function sortAircraft(aircraft = []) {
  return [...aircraft].sort((a, b) => {
    const aScore = (a.onGround ? 0 : 1) * 1000000 + (a.velocity || 0) + (a.geoAltitude || 0);
    const bScore = (b.onGround ? 0 : 1) * 1000000 + (b.velocity || 0) + (b.geoAltitude || 0);
    return bScore - aScore;
  });
}

function normalizeSearchKey(value = '') {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function uniqueValues(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function pickBestAircraft(matches = [], query = '') {
  const normalized = normalizeSearchKey(query);
  return (
    matches.find((item) => normalizeSearchKey(item.callsign) === normalized) ||
    matches.find((item) => normalizeSearchKey(item.icao24) === normalized) ||
    matches[0] ||
    null
  );
}

async function buildEnrichmentPayload({ aircraft = null, query = '', airportCode = '' } = {}) {
  const normalizedQuery = normalizeSearchKey(query);
  const searchCandidates = uniqueValues([
    aircraft?.callsign,
    aircraft?.icao24,
    query,
    normalizedQuery,
    normalizedQuery.replace(/^[A-Z]+/, ''),
  ]);
  let commercial = null;
  for (const candidate of searchCandidates) {
    if (!candidate) continue;
    commercial = await lookupCommercialFlight(candidate, {
      query: normalizedQuery,
      airportCode,
      liveAircraft: aircraft,
    });
    if (commercial?.available || commercial?.flightNumber) break;
  }
  if (!commercial) {
    commercial = await lookupCommercialFlight(normalizedQuery || query, {
      query: normalizedQuery,
      airportCode,
      liveAircraft: aircraft,
    });
  }
  const route = buildCommercialRoute(aircraft, commercial);
  const dataAvailability = {
    hasLivePosition:
      !!aircraft &&
      Number.isFinite(Number(aircraft.latitude)) &&
      Number.isFinite(Number(aircraft.longitude)),
    hasCommercialSchedule: !!commercial?.available || !!commercial?.flightNumber,
    hasRoute: !!route,
    hasEta: !!route?.remainingMinutes,
  };
  return {
    commercial,
    route,
    dataAvailability,
  };
}

function truncateAircraft(aircraft = [], limit = DEFAULT_CONFIG.maxAircraftReturned) {
  const requested = Number(limit) || DEFAULT_CONFIG.maxAircraftReturned;
  const capped = Math.min(DEFAULT_CONFIG.maxAircraftHardLimit, Math.max(1, requested));
  return sortAircraft(aircraft).slice(0, capped);
}

function getRateLimitSnapshot() {
  const limit = Math.max(1, Number(DEFAULT_CONFIG.rateLimitPerMinute) || 1);
  const now = Date.now();
  if (now - requestWindow.startedAt >= 60_000) {
    requestWindow.startedAt = now;
    requestWindow.count = 0;
    requestWindow.blockedAt = null;
  }
  return {
    limit,
    windowStartedAt: new Date(requestWindow.startedAt).toISOString(),
    count: requestWindow.count,
    remaining: Math.max(0, limit - requestWindow.count),
    blockedAt: requestWindow.blockedAt ? new Date(requestWindow.blockedAt).toISOString() : null,
  };
}

function canPerformNetworkFetch() {
  const snapshot = getRateLimitSnapshot();
  if (snapshot.count >= snapshot.limit) {
    requestWindow.blockedAt = Date.now();
    return false;
  }
  requestWindow.count += 1;
  return true;
}

function getTrackerConfig() {
  return { ...DEFAULT_CONFIG };
}

function getProviderStatus() {
  return {
    provider: 'opensky',
    authMode: tokenState.mode,
    authenticated: tokenState.mode === 'authenticated',
    hasCredentials: !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET),
    tokenExpiresAt: tokenState.expiresAt ? new Date(tokenState.expiresAt).toISOString() : null,
    lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
    lastSuccessfulFetchAt: lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).toISOString() : null,
    lastError: lastError || null,
    rateLimit: getRateLimitSnapshot(),
    commercial: getCommercialProviderStatus(),
  };
}

async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (tokenState.token && Date.now() < tokenState.expiresAt - 60_000) {
    return tokenState.token;
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);

  const { data } = await axios.post(OPEN_SKY_TOKEN_URL, body.toString(), {
    timeout: Number(process.env.OPENSKY_TIMEOUT_MS || 25000);
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const token = String(data?.access_token || '').trim();
  const expiresIn = safeInt(data?.expires_in, 1800);
  if (!token) throw new Error('OpenSky token response missing access_token');

  tokenState = {
    token,
    expiresAt: Date.now() + Math.max(60_000, expiresIn * 1000),
    mode: 'authenticated',
  };
  return token;
}

async function fetchOpenSkyStates(params = {}, { forceAnonymous = false } = {}) {
  if (mockState) {
    return normalizeResponse(mockState, mockState.source || 'mock');
  }

  const query = new URLSearchParams();
  if (params.time) query.set('time', String(params.time));
  if (Array.isArray(params.icao24) && params.icao24.length) {
    params.icao24.forEach((item) => query.append('icao24', String(item).toLowerCase()));
  }
  if (params.bbox) {
    const bbox = parseBoundingBox(params.bbox);
    if (bbox) {
      query.set('lamin', String(bbox.lamin));
      query.set('lomin', String(bbox.lomin));
      query.set('lamax', String(bbox.lamax));
      query.set('lomax', String(bbox.lomax));
    }
  }
  if (params.extended !== false) query.set('extended', '1');

  let source = 'opensky-anonymous';
  const headers = {};
  if (!forceAnonymous) {
    try {
      const token = await getOpenSkyToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        source = 'opensky-authenticated';
      }
    } catch (error) {
      lastError = error.message;
      tokenState = { token: null, expiresAt: 0, mode: 'anonymous' };
      source = 'opensky-anonymous';
    }
  }

  const response = await axios.get(`${OPEN_SKY_BASE}/states/all?${query.toString()}`, {
    timeout: Number(process.env.OPENSKY_TIMEOUT_MS || 25000),
    headers,
  });

  lastFetchAt = Date.now();
  lastSuccessfulFetchAt = lastFetchAt;
  lastError = '';
  tokenState.mode = source.includes('authenticated') ? 'authenticated' : 'anonymous';
  return normalizeResponse(response.data, source);
}

async function fetchStatesWithFallback(params = {}) {
  try {
    return await fetchOpenSkyStates(params, { forceAnonymous: false });
  } catch (error) {
    lastError = error.message;
    if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
      try {
        return await fetchOpenSkyStates(params, { forceAnonymous: true });
      } catch (anonymousError) {
        lastError = anonymousError.message;
        return {
          time: Math.floor(Date.now() / 1000),
          source: 'unavailable',
          error: anonymousError.message,
          aircraft: [],
        };
      }
    }

    return {
      time: Math.floor(Date.now() / 1000),
      source: 'unavailable',
      error: error.message,
      aircraft: [],
    };
  }
}

async function getLiveAircraft(params = {}) {
  const airportCode = String(params.airportCode || '').trim().toUpperCase();
  const airport = airportCode ? getAirportByCode(airportCode) : null;
  const region = String(params.region || DEFAULT_CONFIG.defaultRegion).toLowerCase();
  const cacheKey = buildCacheKey({ ...params, airportCode, region });
  const cached = cache.get(cacheKey);
  const ttl = DEFAULT_CONFIG.cacheDurationMs;
  const now = Date.now();

  if (cached && now - cached.fetchedAt < ttl) {
    analytics.recordCacheHit('opensky');
    return { ...cached.payload, source: 'cache', cached: true, cachedAt: cached.fetchedAt };
  }
  if (inFlight.has(cacheKey)) {
    analytics.recordDedup('opensky');
    return inFlight.get(cacheKey);
  }
  if (now - lastFetchAt < Math.min(15_000, ttl) && cached) {
    analytics.recordCacheHit('opensky');
    return { ...cached.payload, source: 'cache', cached: true, cachedAt: cached.fetchedAt };
  }
  if (!canPerformNetworkFetch()) {
    if (cached) {
      analytics.recordThrottle('opensky');
      analytics.recordCacheHit('opensky', { stale: now - cached.fetchedAt >= ttl });
      return {
        ...cached.payload,
        source: 'cache',
        cached: true,
        throttled: true,
        cachedAt: cached.fetchedAt,
        disclaimer: `${cached.payload.disclaimer} Live updates are temporarily throttled.`,
      };
    }
    return {
      provider: 'opensky',
      source: 'throttled',
      region,
      regionLabel: REGION_LABELS[region] || REGION_LABELS.global,
      airportCode: airport?.airportCode || airportCode || '',
      airport: airport
        ? {
            ...airport,
            boundingBox: buildAirportBounds(airport),
            center: [airport.latitude, airport.longitude],
          }
        : null,
      liveArea: airport ? 'airport' : region,
      aircraft: [],
      totalAircraft: 0,
      returnedAircraft: 0,
      updatedAt: new Date().toISOString(),
      providerStatus: getProviderStatus(),
      filters: {
        query: String(params.query || '').trim(),
        country: String(params.country || '').trim(),
        airborneOnly: !!params.airborneOnly,
        includeGround: !!params.includeGround,
        minAltitude: params.minAltitude ?? null,
        maxAltitude: params.maxAltitude ?? null,
        minSpeed: params.minSpeed ?? null,
        maxSpeed: params.maxSpeed ?? null,
      },
      disclaimer: 'OpenSky live updates are temporarily throttled. The last available snapshot is shown when possible.',
      center: airport ? [airport.latitude, airport.longitude] : getRegionCenter(region),
      throttled: true,
      summary: getTrackerSummary({ aircraft: [] }),
    };
  }

  const promise = (async () => {
    const startedAt = Date.now();
    const bbox =
      params.bbox ||
      (airport ? buildAirportBounds(airport) : region && region !== 'global' ? getRegionBounds(region) : null);
    const response = await fetchStatesWithFallback({ bbox, extended: true });
    analytics.recordCall('opensky', Date.now() - startedAt);
    const source = response.source || 'unavailable';
    const limit = Number(params.limit || DEFAULT_CONFIG.maxAircraftReturned);
    const filtered = truncateAircraft(
      filterAircraft(response.aircraft || [], {
        query: params.query,
        country: params.country,
        airborneOnly: params.airborneOnly,
        includeGround: params.includeGround,
        minAltitude: params.minAltitude,
        maxAltitude: params.maxAltitude,
        minSpeed: params.minSpeed,
        maxSpeed: params.maxSpeed,
      }),
      limit
    );

    const payload = {
      provider: 'opensky',
      source,
      region,
      regionLabel: REGION_LABELS[region] || REGION_LABELS.global,
      airportCode: airport?.airportCode || airportCode || '',
      airport: airport
        ? {
            ...airport,
            boundingBox: buildAirportBounds(airport),
            center: [airport.latitude, airport.longitude],
          }
        : null,
      liveArea: airport ? 'airport' : region,
      aircraft: filtered,
      totalAircraft: response.aircraft?.length || 0,
      returnedAircraft: filtered.length,
      updatedAt: new Date().toISOString(),
      providerStatus: getProviderStatus(),
      filters: {
        query: String(params.query || '').trim(),
        country: String(params.country || '').trim(),
        airborneOnly: !!params.airborneOnly,
        includeGround: !!params.includeGround,
        minAltitude: params.minAltitude ?? null,
        maxAltitude: params.maxAltitude ?? null,
        minSpeed: params.minSpeed ?? null,
        maxSpeed: params.maxSpeed ?? null,
      },
      disclaimer: 'OpenSky data may be delayed by network and transponder coverage conditions.',
      center: airport
        ? [airport.latitude, airport.longitude]
        : getRegionCenter(region),
      summary: getTrackerSummary({ aircraft: filtered }),
    };

    cache.set(cacheKey, { fetchedAt: Date.now(), payload });
    return payload;
  })().catch((error) => {
    analytics.recordFailure('opensky', error);
    if (cached && Date.now() - cached.fetchedAt < DEFAULT_CONFIG.staleCacheDurationMs) {
      analytics.recordCacheHit('opensky', { stale: true });
      return {
        ...cached.payload,
        source: 'cache',
        cached: true,
        stale: true,
        cachedAt: cached.fetchedAt,
        providerStatus: getProviderStatus(),
        disclaimer: `${cached.payload.disclaimer} Showing stale OpenSky data while the provider recovers.`,
      };
    }
    throw error;
  }).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, promise);
  return promise;
}

async function getAircraftByIcao24(icao24, params = {}) {
  const target = String(icao24 || '').trim().toLowerCase();
  if (!target) {
    return { aircraft: null, source: 'invalid', updatedAt: new Date().toISOString() };
  }

  const cached = await getLiveAircraft({ ...params, query: target, limit: Math.max(25, params.limit || 75) });
  const aircraft = (cached.aircraft || []).find((item) => item.icao24 === target) || null;
  const enrichment = await buildEnrichmentPayload({
    aircraft,
    query: aircraft?.callsign || target,
    airportCode: cached.airportCode || params.airportCode || '',
  });
  return {
    ...cached,
    aircraft,
    selectedAircraft: aircraft,
    ...enrichment,
    searchQuery: target,
  };
}

async function searchAircraft(query, params = {}) {
  const normalized = String(query || '').trim().toLowerCase();
  const airport = getAirportByCode(normalized.toUpperCase());
  const live = await getLiveAircraft({
    ...params,
    airportCode: airport?.airportCode || params.airportCode,
    query: normalized,
    limit: params.limit || 75,
    includeGround: true,
  });
  const matches = (live.aircraft || []).filter((item) => containsQuery(item, normalized));
  const payload = {
    ...live,
    query: normalized,
    airport,
    aircraft: matches,
    totalMatches: matches.length,
    selectedAircraft: pickBestAircraft(matches, normalized),
  };
  const bestAircraft = payload.selectedAircraft || null;
  const enrichment = await buildEnrichmentPayload({
    aircraft: bestAircraft,
    query: bestAircraft?.callsign || normalized,
    airportCode: airport?.airportCode || params.airportCode || live.airportCode || '',
  });
  return {
    ...payload,
    ...enrichment,
    searchCandidates: uniqueValues([
      bestAircraft?.callsign,
      bestAircraft?.icao24,
      normalized,
      normalized.replace(/^[A-Z]+/, ''),
    ]),
  };
}

async function getAirportSnapshot(airportCode, params = {}) {
  const airport = getAirportByCode(airportCode);
  if (!airport) {
    return {
      airportCode: String(airportCode || '').toUpperCase(),
      airport: null,
      aircraft: [],
      arrivals: [],
      departures: [],
      commercial: {
        provider: getCommercialProviderStatus().provider,
        available: false,
        arrivals: [],
        departures: [],
      },
      providerStatus: getProviderStatus(),
      updatedAt: new Date().toISOString(),
      disclaimer: 'Airport data is not available for this code.',
    };
  }

  const live = await getLiveAircraft({
    ...params,
    airportCode: airport.airportCode,
    limit: params.limit || 50,
    includeGround: true,
  });

  return {
    ...live,
    airport,
    arrivals: [],
    departures: [],
    commercial: await lookupCommercialAirportSchedule(airport.airportCode, { airport }),
    airportCode: airport.airportCode,
    airportName: airport.name,
    liveAircraft: live.aircraft,
    transferTips: airport.transferTips,
    baggageTips: airport.baggageTips,
    relatedRoutes: airport.relatedRoutes,
  };
}

async function getHealth() {
  const config = getTrackerConfig();
  const cachedKeys = [...cache.keys()];
  const latestCache = [...cache.values()].sort((a, b) => b.fetchedAt - a.fetchedAt)[0] || null;
  const cacheAgeMs = latestCache ? Date.now() - latestCache.fetchedAt : null;
  return {
    enabled: config.enabled,
    provider: 'opensky',
    authMode: tokenState.mode,
    providerStatus: getProviderStatus(),
    commercialProviderStatus: getCommercialProviderStatus(),
    cacheDurationMs: config.cacheDurationMs,
    staleCacheDurationMs: config.staleCacheDurationMs,
    cacheAgeMs,
    maxAircraftReturned: config.maxAircraftReturned,
    maxAircraftHardLimit: config.maxAircraftHardLimit,
    defaultRegion: config.defaultRegion,
    enabledRegions: config.enabledRegions,
    supportedAirports: getAirportCodes(),
    cacheEntries: cachedKeys.length,
    lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
    lastSuccessfulFetchAt: lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).toISOString() : null,
    lastError: lastError || null,
    lastCacheAt: latestCache ? new Date(latestCache.fetchedAt).toISOString() : null,
    rateLimit: getRateLimitSnapshot(),
    aircraftCount: latestCache?.payload?.aircraft?.length || 0,
    available: (latestCache?.payload?.aircraft || []).length > 0 || config.enabled,
    disclaimer: 'OpenSky state data may lag real-world movement and can be rate limited.',
    analytics: analytics.getAnalytics(),
    updatedAt: new Date().toISOString(),
  };
}

function getTrackerSummary(payload = {}) {
  const aircraft = Array.isArray(payload.aircraft) ? payload.aircraft : [];
  const altitudeValues = aircraft
    .map((item) => item.geoAltitude ?? item.baroAltitude ?? null)
    .filter((value) => value !== null && value !== undefined);
  return {
    totalAircraft: aircraft.length,
    airborne: aircraft.filter((item) => !item.onGround).length,
    onGround: aircraft.filter((item) => item.onGround).length,
    countries: [...new Set(aircraft.map((item) => item.originCountry).filter(Boolean))].slice(0, 12),
    averageAltitude: altitudeValues.length
      ? Math.round(altitudeValues.reduce((sum, value) => sum + value, 0) / altitudeValues.length)
      : 0,
  };
}

function __setMockState(value = null) {
  mockState = value;
}

module.exports = {
  DEFAULT_CONFIG,
  fetchOpenSkyStates,
  filterAircraft,
  getAirportSnapshot,
  getAircraftByIcao24,
  getHealth,
  getLiveAircraft,
  getProviderStatus,
  getTrackerConfig,
  getTrackerSummary,
  normalizeResponse,
  normalizeState,
  searchAircraft,
  __test: {
    __setMockState,
    buildAirportBounds,
    buildCacheKey,
    getAirportByCode,
    getRegionBounds,
    getRegionCenter,
  },
};
