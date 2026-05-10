const fr24 = require('./flightRadar24Service');
const {
  getLiveAircraft: openSkyGetLive,
  searchAircraft: openSkySearch,
  getAircraftByIcao24: openSkyGetByIcao24,
  getAirportSnapshot: openSkyGetAirport,
  getHealth: openSkyGetHealth,
  getProviderStatus: openSkyGetStatus,
  getTrackerSummary,
} = require('./flightTrackerService');
const {
  lookupCommercialFlight,
  buildCommercialRoute,
  getCommercialProviderStatus,
} = require('./flightTrackerCommercialService');
const { getAnalytics } = require('./flightTrackerAnalytics');

const liveAircraftByRegion = new Map();

function nowIso() {
  return new Date().toISOString();
}

function trackerLog(tag, message) {
  process.stdout.write(`[${nowIso()}] ${tag} ${message}\n`);
}

function getRegionKey(params = {}) {
  if (params.airportCode) return `airport:${String(params.airportCode).toUpperCase()}`;
  return `region:${String(params.region || 'global').toLowerCase()}`;
}

function cacheLiveAircraft(regionKey, aircraft) {
  if (!Array.isArray(aircraft) || aircraft.length === 0) return;
  liveAircraftByRegion.set(regionKey, { aircraft, cachedAt: Date.now() });
}

function normalizeSearchKey(value) {
  return String(value || '').toUpperCase().replace(/[\s-]/g, '');
}

function searchCachedAircraft(query) {
  const q = normalizeSearchKey(query);
  if (!q) return null;

  for (const { aircraft } of liveAircraftByRegion.values()) {
    for (const ac of aircraft) {
      if (
        normalizeSearchKey(ac.callsign) === q ||
        normalizeSearchKey(ac.flightNumber) === q ||
        normalizeSearchKey(ac.registration) === q ||
        String(ac.icao24 || '').toLowerCase() === String(query || '').toLowerCase()
      ) {
        return ac;
      }
    }
  }
  return null;
}

function makeProviderDebug({
  actualProvider = 'opensky',
  fallbackUsed = false,
  openskyMatched = null,
  fr24Attempted = false,
  fr24Matched = false,
  fr24Error = null,
} = {}) {
  const budgetSt = fr24.getProviderStatus();
  return {
    primaryProvider: 'opensky',
    actualProvider,
    fallbackUsed,
    fr24Attempted,
    fr24Matched,
    fr24Error,
    fr24AircraftRaw: null,
    fr24CacheHit: null,
    fr24StaleCacheUsed: null,
    fr24BudgetRemaining: budgetSt.budgetRemaining,
    fr24NextAvailableAt: budgetSt.budgetNextAvailableAt,
    openskyMatched,
  };
}

function dataAvailability(aircraft, commercial, route) {
  return {
    hasLivePosition:
      !!aircraft &&
      Number.isFinite(Number(aircraft.latitude)) &&
      Number.isFinite(Number(aircraft.longitude)),
    hasCommercialSchedule: !!commercial?.available || !!commercial?.flightNumber,
    hasRoute: !!route,
    hasEta: !!route?.remainingMinutes,
  };
}

async function enrichAircraft(aircraft, query, context = {}) {
  const commercial = await lookupCommercialFlight(query || aircraft?.callsign || aircraft?.icao24 || '', {
    ...context,
    liveAircraft: aircraft,
  });
  const route = buildCommercialRoute(aircraft, commercial);
  return {
    commercial,
    route,
    dataAvailability: dataAvailability(aircraft, commercial, route),
  };
}

async function getLiveAircraft(params = {}) {
  const payload = await openSkyGetLive(params);
  cacheLiveAircraft(getRegionKey(params), payload.aircraft);

  return {
    ...payload,
    aggregator: 'opensky-live',
    providerPriority: ['opensky:live-map', 'commercial:lazy-metadata', 'fr24:optional-premium'],
    providerDebug: makeProviderDebug({
      actualProvider: 'opensky',
      openskyMatched: (payload.aircraft?.length || 0) > 0,
    }),
  };
}

async function searchAircraft(query, params = {}) {
  const cachedMatch = searchCachedAircraft(query);
  if (cachedMatch) {
    trackerLog('[CACHE SEARCH]', `"${query}" matched icao24=${cachedMatch.icao24} callsign=${cachedMatch.callsign}`);
    const enrichment = await enrichAircraft(cachedMatch, query, { airportCode: params.airportCode || '' });
    return {
      provider: cachedMatch.source || 'opensky',
      source: cachedMatch.source || 'live-cache',
      query,
      aircraft: [cachedMatch],
      totalMatches: 1,
      selectedAircraft: cachedMatch,
      ...enrichment,
      updatedAt: nowIso(),
      aggregator: 'opensky-cache',
      providerDebug: makeProviderDebug({
        actualProvider: 'opensky',
        openskyMatched: true,
      }),
    };
  }

  trackerLog('[SEARCH -> OPENSKY]', `"${query}" not in live cache`);
  const payload = await openSkySearch(query, params);
  return {
    ...payload,
    aggregator: 'opensky-search',
    providerDebug: makeProviderDebug({
      actualProvider: 'opensky',
      openskyMatched: (payload.totalMatches || 0) > 0,
    }),
  };
}

async function getAircraftByIcao24(icao24, params = {}) {
  const match = searchCachedAircraft(icao24);
  if (match) {
    trackerLog('[CACHE ICAO24]', `icao24=${icao24} matched live cache`);
    const enrichment = await enrichAircraft(match, match.callsign || icao24, { airportCode: params.airportCode || '' });
    return {
      provider: match.source || 'opensky',
      source: match.source || 'live-cache',
      aircraft: match,
      selectedAircraft: match,
      ...enrichment,
      searchQuery: icao24,
      updatedAt: nowIso(),
      aggregator: 'opensky-cache',
      providerDebug: makeProviderDebug({
        actualProvider: 'opensky',
        openskyMatched: true,
      }),
    };
  }

  const payload = await openSkyGetByIcao24(icao24, params);
  return {
    ...payload,
    aggregator: 'opensky-aircraft',
    providerDebug: makeProviderDebug({
      actualProvider: 'opensky',
      openskyMatched: !!payload.aircraft,
    }),
  };
}

async function getFlightDetails(flightId) {
  trackerLog('[FR24 DETAILS]', `flightId="${flightId}"`);
  if (!fr24.isConfigured()) {
    return { available: false, source: 'none', error: 'FLIGHTRADAR24_API_KEY is not set.' };
  }
  return fr24.getFlightDetails(flightId);
}

async function getFlightTrack(flightId) {
  trackerLog('[FR24 TRACK]', `flightId="${flightId}"`);
  if (!fr24.isConfigured()) {
    return { available: false, source: 'none', error: 'FLIGHTRADAR24_API_KEY is not set.' };
  }
  return fr24.getFlightTrack(flightId);
}

async function getAirportSnapshot(airportCode, params = {}) {
  const payload = await openSkyGetAirport(airportCode, params);
  cacheLiveAircraft(`airport:${String(airportCode || '').toUpperCase()}`, payload.aircraft);
  return {
    ...payload,
    aggregator: 'opensky-airport',
    providerDebug: makeProviderDebug({
      actualProvider: 'opensky',
      openskyMatched: (payload.aircraft?.length || 0) > 0,
    }),
  };
}

async function getHealth() {
  const openskyHealth = await openSkyGetHealth();
  return {
    ...openskyHealth,
    primaryProvider: 'opensky',
    providers: {
      flightradar24: fr24.getProviderStatus(),
      opensky: openSkyGetStatus(),
      commercial: getCommercialProviderStatus(),
    },
    providerPriority: {
      liveMap: 'opensky',
      metadata: ['aerodatabox', 'aviationstack', 'partial'],
      premiumEnhancements: 'flightradar24',
    },
    analytics: getAnalytics(),
    aggregator: 'flightTrackerProviderAggregator',
    providerDebug: makeProviderDebug({ actualProvider: 'opensky' }),
    updatedAt: nowIso(),
  };
}

module.exports = {
  getLiveAircraft,
  searchAircraft,
  getAircraftByIcao24,
  getFlightDetails,
  getFlightTrack,
  getAirportSnapshot,
  getHealth,
};
