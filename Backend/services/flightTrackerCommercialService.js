const axios = require('axios');
const { getAirportByCode } = require('./flightTrackerData');
const analytics = require('./flightTrackerAnalytics');
const aeroDataBox = require('./aeroDataBoxService');

const DEFAULT_TIMEOUT_MS = Number(
  process.env.OPENSKY_TIMEOUT_MS || 25000
);
const CACHE_TTL_MS = Number(process.env.FLIGHT_TRACKER_COMMERCIAL_CACHE_MS || 5 * 60_000);
const STALE_CACHE_TTL_MS = Number(process.env.FLIGHT_TRACKER_COMMERCIAL_STALE_CACHE_MS || 30 * 60_000);
const COOLDOWN_MS = Number(process.env.FLIGHT_TRACKER_COMMERCIAL_COOLDOWN_MS || 2500);

const cache = new Map();
const inFlight = new Map();
const cooldowns = new Map();
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
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const date = new Date(Number(value) > 1e12 ? Number(value) : Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCode(value) {
  return safeText(value, '').toUpperCase();
}

function normalizeQuery(value) {
  return safeText(value, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function buildAirportRef(value, fallbackCode = '') {
  const code = normalizeCode(
    value?.iata ||
      value?.iataCode ||
      value?.icao ||
      value?.icaoCode ||
      value?.airportCode ||
      value?.origin ||
      value?.destination ||
      fallbackCode
  );
  const airport = getAirportByCode(code) || getAirportByCode(fallbackCode);
  return {
    code: airport?.airportCode || code || null,
    icaoCode: airport?.icaoCode || normalizeCode(value?.icao || value?.icaoCode || ''),
    name: safeText(value?.airport || value?.name || airport?.name || ''),
    city: safeText(value?.city || airport?.city || ''),
    country: safeText(value?.country || airport?.country || ''),
    terminal: safeText(value?.terminal || ''),
    gate: safeText(value?.gate || ''),
    latitude: safeNumber(value?.latitude ?? airport?.latitude, null),
    longitude: safeNumber(value?.longitude ?? airport?.longitude, null),
  };
}

function deriveFlightStatusFromFlightAware(item = {}) {
  if (item.actual_out === null || item.actual_out === undefined) return item.status || 'scheduled';
  if (item.actual_out !== null && item.actual_on === null) return 'active';
  if (item.actual_out !== null && item.actual_on !== null && item.actual_out !== item.actual_on) return 'landed';
  return item.status || 'unknown';
}

function normalizeAviationstackFlight(item = {}, query = '') {
  const departure = item.departure || {};
  const arrival = item.arrival || {};
  const airline = item.airline || {};
  const flight = item.flight || {};
  const flightNumber = safeText(
    flight.iata ||
      flight.icao ||
      flight.number ||
      item.flight_number ||
      query,
    query
  );

  return {
    flightNumber,
    airline: safeText(airline.name || airline.iata || airline.icao || ''),
    departureAirport: buildAirportRef(departure, departure.iata || departure.icao || ''),
    arrivalAirport: buildAirportRef(arrival, arrival.iata || arrival.icao || ''),
    scheduledDeparture: toIso(departure.scheduled || departure.time || departure.estimated || departure.actual),
    scheduledArrival: toIso(arrival.scheduled || arrival.time || arrival.estimated || arrival.actual),
    estimatedArrival: toIso(arrival.estimated || arrival.time || arrival.actual || arrival.scheduled),
    status: safeText(item.flight_status || item.status || 'unknown'),
    delayMinutes: safeNumber(arrival.delay ?? departure.delay, null),
    terminal: safeText(arrival.terminal || departure.terminal || ''),
    gate: safeText(arrival.gate || departure.gate || ''),
    provider: 'aviationstack',
  };
}

function normalizeFlightAwareFlight(item = {}, query = '') {
  const departure = item.departure || {};
  const arrival = item.arrival || {};
  const airline = item.airline || {};
  const codeshared = item.codeshared || {};
  const flight = item.flight || {};
  const flightNumber = safeText(
    item.ident ||
      flight.iataNumber ||
      flight.icaoNumber ||
      flight.number ||
      codeshared?.flight?.iataNumber ||
      codeshared?.flight?.icaoNumber ||
      query,
    query
  );

  const status = deriveFlightStatusFromFlightAware(item);
  const scheduledDeparture = toIso(item.scheduled_out || departure.scheduledTime || departure.time || departure.scheduled);
  const scheduledArrival = toIso(item.scheduled_in || arrival.scheduledTime || arrival.time || arrival.scheduled);
  const estimatedArrival = toIso(item.estimated_in || arrival.estimatedTime || arrival.time || arrival.scheduled);

  return {
    flightNumber,
    airline: safeText(airline.name || codeshared?.airline?.name || airline.iataCode || airline.icaoCode || ''),
    departureAirport: buildAirportRef(
      {
        ...departure,
        airport: departure.airport || departure.name,
        iata: departure.iataCode || departure.iata,
        icao: departure.icaoCode || departure.icao,
        terminal: departure.terminal,
        gate: departure.gate,
      },
      departure.iataCode || departure.icaoCode || ''
    ),
    arrivalAirport: buildAirportRef(
      {
        ...arrival,
        airport: arrival.airport || arrival.name,
        iata: arrival.iataCode || arrival.iata,
        icao: arrival.icaoCode || arrival.icao,
        terminal: arrival.terminal,
        gate: arrival.gate,
      },
      arrival.iataCode || arrival.icaoCode || ''
    ),
    scheduledDeparture,
    scheduledArrival,
    estimatedArrival,
    status,
    delayMinutes: safeNumber(item.departure?.delay ?? item.arrival?.delay ?? item.delay_minutes ?? null, null),
    terminal: safeText(arrival.terminal || departure.terminal || ''),
    gate: safeText(arrival.gate || departure.gate || ''),
    provider: 'flightaware',
  };
}

function normalizeCommercialList(items = [], provider = 'none', query = '') {
  return items
    .map((item) => {
      if (provider === 'aviationstack') return normalizeAviationstackFlight(item, query);
      if (provider === 'flightaware') return normalizeFlightAwareFlight(item, query);
      return null;
    })
    .filter(Boolean);
}

function getCommercialProviderConfig() {
  const provider = String(process.env.FLIGHT_TRACKER_COMMERCIAL_PROVIDER || 'none').toLowerCase();
  const enrichmentProvider = String(process.env.FLIGHT_TRACKER_ENRICHMENT_PROVIDER || '').toLowerCase();
  const aviationstackApiKey = safeText(process.env.AVIATIONSTACK_API_KEY || '');
  const flightawareApiKey = safeText(process.env.FLIGHTAWARE_API_KEY || '');
  const aeroDataBoxStatus = aeroDataBox.getProviderStatus();
  return {
    provider,
    enrichmentProvider,
    effectiveProvider: aeroDataBoxStatus.configured ? 'aerodatabox' : provider,
    aviationstackApiKey,
    flightawareApiKey,
    aeroDataBoxConfigured: aeroDataBoxStatus.configured,
    configured:
      aeroDataBoxStatus.configured ||
      (provider === 'aviationstack' && !!aviationstackApiKey) ||
      (provider === 'flightaware' && !!flightawareApiKey),
    cacheTtlMs: CACHE_TTL_MS,
    staleCacheTtlMs: STALE_CACHE_TTL_MS,
    cooldownMs: COOLDOWN_MS,
  };
}

function getCommercialProviderStatus() {
  const config = getCommercialProviderConfig();
  return {
    provider: config.effectiveProvider,
    fallbackProvider: config.provider,
    enrichmentProvider: config.enrichmentProvider || null,
    configured: config.configured,
    hasCredentials: config.configured,
    priority: ['aerodatabox', 'aviationstack', 'partial'],
    aerodatabox: aeroDataBox.getProviderStatus(),
    cacheEntries: cache.size,
    inFlightRequests: inFlight.size,
    staleCacheTtlMs: STALE_CACHE_TTL_MS,
    cooldownMs: COOLDOWN_MS,
    lastError: lastError || null,
    lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
    lastSuccessfulFetchAt: lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).toISOString() : null,
  };
}

function buildCacheKey(prefix, query, extra = '') {
  return [prefix, normalizeQuery(query), extra].filter(Boolean).join(':');
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.fetchedAt > CACHE_TTL_MS) {
    return null;
  }
  analytics.recordCacheHit('commercial');
  return item.payload;
}

function getStaleCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.fetchedAt > STALE_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  analytics.recordCacheHit('commercial', { stale: true });
  return { ...item.payload, cached: true, stale: true };
}

function setCached(key, payload) {
  cache.set(key, { fetchedAt: Date.now(), payload });
}

async function dedupeProviderRequest(cacheKey, provider, work) {
  if (inFlight.has(cacheKey)) {
    analytics.recordDedup('commercial');
    return inFlight.get(cacheKey);
  }

  const nextAllowedAt = cooldowns.get(cacheKey) || 0;
  if (Date.now() < nextAllowedAt) {
    analytics.recordThrottle('commercial');
    const stale = getStaleCached(cacheKey);
    if (stale) return stale;
    return buildUnavailable(provider, 'Commercial enrichment is cooling down. Try again shortly.');
  }

  const promise = work().finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  return promise;
}

function getFlightAwareStatusPayload(data = {}) {
  const flights = Array.isArray(data?.flights) ? data.flights : Array.isArray(data?.results) ? data.results : [];
  return flights;
}

async function fetchAviationstackFlights(params = {}) {
  const config = getCommercialProviderConfig();
  const searchParams = new URLSearchParams();
  searchParams.set('access_key', config.aviationstackApiKey);
  searchParams.set('limit', String(params.limit || 5));

  if (params.flightIata) searchParams.set('flight_iata', params.flightIata);
  else if (params.flightIcao) searchParams.set('flight_icao', params.flightIcao);
  else if (params.flightNumber) searchParams.set('flight_number', params.flightNumber);
  else if (params.depIata) searchParams.set('dep_iata', params.depIata);
  else if (params.arrIata) searchParams.set('arr_iata', params.arrIata);

  const { data } = await axios.get(`https://api.aviationstack.com/v1/flights?${searchParams.toString()}`, {
    timeout: DEFAULT_TIMEOUT_MS,
  });
  return Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : [];
}

async function fetchFlightAwareFlights(params = {}) {
  const config = getCommercialProviderConfig();
  const ident = normalizeTextToIdent(params.ident || params.flightNumber || params.query || '');
  if (!ident) return [];
  const { data } = await axios.get(`https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(ident)}`, {
    timeout: DEFAULT_TIMEOUT_MS,
    headers: { 'x-apikey': config.flightawareApiKey },
    params: { max_pages: params.maxPages || 1 },
  });
  return getFlightAwareStatusPayload(data);
}

function normalizeTextToIdent(value = '') {
  return safeText(value, '').replace(/\s+/g, '').toUpperCase();
}

function uniqueValues(values = []) {
  return [...new Set(values.map((item) => safeText(item)).filter(Boolean))];
}

function hasUsefulCommercialData(payload = {}) {
  return !!(
    payload?.available &&
    (
      payload.flightNumber ||
      payload.airline ||
      payload.departureAirport?.code ||
      payload.arrivalAirport?.code ||
      payload.aircraftType ||
      payload.estimatedArrival
    )
  );
}

function mergeAeroDataBoxPayload(schedule = {}, aircraft = null, route = null) {
  if (!schedule?.available) return schedule;
  return {
    ...schedule,
    airline: schedule.airline || aircraft?.airline || '',
    aircraftType: schedule.aircraftType || aircraft?.aircraftType || '',
    aircraftModel: schedule.aircraftModel || aircraft?.aircraftModel || '',
    registration: schedule.registration || aircraft?.registration || '',
    icao24: schedule.icao24 || aircraft?.icao24 || '',
    route: route?.available ? route : null,
    distanceKm: schedule.distanceKm || route?.distanceKm || null,
    providerDetails: {
      aerodatabox: {
        matchingConfidence: schedule.matchingConfidence ?? null,
        hasAircraft: !!aircraft?.available,
        hasRoute: !!route?.available,
      },
    },
  };
}

async function lookupAeroDataBoxFlight(query, context = {}) {
  if (!aeroDataBox.isConfigured()) {
    return buildUnavailable('aerodatabox', 'AeroDataBox credentials are not configured.');
  }

  const live = context.liveAircraft || {};
  const candidates = uniqueValues([
    live.callsign,
    live.flightNumber,
    query,
    normalizeTextToIdent(query),
    live.icao24,
    live.registration,
  ]);

  let best = null;
  for (const candidate of candidates) {
    const schedule = await aeroDataBox.getFlightSchedule(candidate, context);
    if (hasUsefulCommercialData(schedule)) {
      best = schedule;
      break;
    }
  }

  if (!best) {
    const search = await aeroDataBox.searchFlight(query, { limit: 5 });
    for (const result of search.results || []) {
      const schedule = await aeroDataBox.getFlightSchedule(result.flightNumber, context);
      if (hasUsefulCommercialData(schedule)) {
        best = schedule;
        break;
      }
    }
  }

  if (!best) return buildUnavailable('aerodatabox', 'No AeroDataBox flight schedule match was found.');

  const aircraftQuery = best.icao24 || best.registration || live.icao24 || live.registration || '';
  const aircraft = aircraftQuery ? await aeroDataBox.getAircraft(aircraftQuery, context) : null;
  const depCode = best.departureAirport?.icaoCode || best.departureAirport?.code || '';
  const arrCode = best.arrivalAirport?.icaoCode || best.arrivalAirport?.code || '';
  const route = depCode && arrCode
    ? await aeroDataBox.getRoute(depCode, arrCode, { aircraftName: best.aircraftType || aircraft?.aircraftType || '' })
    : null;
  return mergeAeroDataBoxPayload(best, aircraft, route);
}

function buildUnavailable(provider, message) {
  return {
    available: false,
    provider,
    error: message || 'Commercial flight data is unavailable.',
    flightNumber: null,
    airline: null,
    departureAirport: {
      code: null,
      icaoCode: null,
      name: '',
      city: '',
      country: '',
      terminal: '',
      gate: '',
      latitude: null,
      longitude: null,
    },
    arrivalAirport: {
      code: null,
      icaoCode: null,
      name: '',
      city: '',
      country: '',
      terminal: '',
      gate: '',
      latitude: null,
      longitude: null,
    },
    scheduledDeparture: null,
    scheduledArrival: null,
    estimatedArrival: null,
    status: 'unavailable',
    delayMinutes: null,
    terminal: null,
    gate: null,
  };
}

async function lookupCommercialFlight(query, context = {}) {
  const normalized = normalizeTextToIdent(query);
  const config = getCommercialProviderConfig();
  const provider = config.effectiveProvider;
  const fallbackProvider = config.provider;
  const cacheKey = buildCacheKey('flight', normalized, `${provider}:${fallbackProvider}:${context.airportCode || ''}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!normalized || !config.configured) {
    const unavailable = buildUnavailable(provider, fallbackProvider === 'none' ? 'Commercial provider is disabled.' : 'Commercial provider credentials are not configured.');
    setCached(cacheKey, unavailable);
    return unavailable;
  }

  return dedupeProviderRequest(cacheKey, provider, async () => {
    lastFetchAt = Date.now();
    const startedAt = Date.now();
    try {
    let items = [];
    let payload = null;

    if (aeroDataBox.isConfigured()) {
      payload = await lookupAeroDataBoxFlight(normalized, context);
      if (hasUsefulCommercialData(payload)) {
        lastSuccessfulFetchAt = lastFetchAt;
        lastError = '';
        analytics.recordCall('commercial', Date.now() - startedAt);
        setCached(cacheKey, payload);
        return payload;
      }
      lastError = payload?.error || 'No AeroDataBox flight schedule match was found.';
    }

    if (fallbackProvider === 'aviationstack') {
      const flightIata = normalized;
      const flightIcao = normalized;
      const flightNumber = normalized.replace(/^[A-Z]+/, '');
      items = await fetchAviationstackFlights({
        flightIata,
        flightIcao,
        flightNumber,
        depIata: context.airportCode ? normalizeCode(context.airportCode) : '',
        arrIata: context.airportCode ? normalizeCode(context.airportCode) : '',
        limit: 5,
      });
    } else if (fallbackProvider === 'flightaware') {
      items = await fetchFlightAwareFlights({
        ident: normalized,
        flightNumber: normalized,
        query: normalized,
        maxPages: 1,
      });
    }

    const normalizedItems = normalizeCommercialList(items, fallbackProvider, normalized);
    const matched = normalizedItems[0] || null;
    payload = matched
      ? {
          available: true,
          provider: fallbackProvider,
          ...matched,
        }
      : buildUnavailable(provider, lastError || 'No commercial flight schedule match was found.');
    if (matched) {
      lastSuccessfulFetchAt = lastFetchAt;
      lastError = '';
    } else {
      lastError = 'No commercial flight schedule match was found.';
    }
    analytics.recordCall('commercial', Date.now() - startedAt);
    setCached(cacheKey, payload);
    return payload;
  } catch (error) {
    analytics.recordFailure('commercial', error);
    lastError = safeText(error?.message || 'Commercial provider lookup failed.');
    cooldowns.set(cacheKey, Date.now() + COOLDOWN_MS);
    const stale = getStaleCached(cacheKey);
    if (stale) return stale;
    const unavailable = buildUnavailable(provider, lastError);
    setCached(cacheKey, unavailable);
    return unavailable;
  }
  });
}

async function lookupCommercialAirportSchedule(airportCode, context = {}) {
  const normalizedAirportCode = normalizeCode(airportCode);
  const config = getCommercialProviderConfig();
  const provider = config.effectiveProvider;
  const fallbackProvider = config.provider;
  const cacheKey = buildCacheKey('airport', normalizedAirportCode, `${provider}:${fallbackProvider}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!normalizedAirportCode || !config.configured) {
    const unavailable = {
      provider,
      available: false,
      airportCode: normalizedAirportCode || null,
      arrivals: [],
      departures: [],
      message: fallbackProvider === 'none' ? 'Commercial provider is disabled.' : 'Commercial provider credentials are not configured.',
    };
    setCached(cacheKey, unavailable);
    return unavailable;
  }

  return dedupeProviderRequest(cacheKey, provider, async () => {
    const startedAt = Date.now();
    try {
    let flights = [];
    let aeroAirport = null;
    if (aeroDataBox.isConfigured()) {
      aeroAirport = await aeroDataBox.getAirport(normalizedAirportCode);
    }

    if (fallbackProvider === 'aviationstack') {
      const airport = getAirportByCode(normalizedAirportCode);
      const depIata = airport?.airportCode || normalizedAirportCode;
      const arrIata = airport?.airportCode || normalizedAirportCode;
      const [departures, arrivals] = await Promise.all([
        fetchAviationstackFlights({ depIata, limit: 5 }),
        fetchAviationstackFlights({ arrIata, limit: 5 }),
      ]);
      flights = { departures, arrivals };
    } else if (fallbackProvider === 'flightaware') {
      const airport = getAirportByCode(normalizedAirportCode);
      const ident = airport?.icaoCode || normalizedAirportCode;
      const { data } = await axios.get(`https://aeroapi.flightaware.com/aeroapi/airports/${encodeURIComponent(ident)}/flights`, {
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { 'x-apikey': config.flightawareApiKey },
      });
      const arrivals = Array.isArray(data?.arrivals) ? data.arrivals : Array.isArray(data?.results) ? data.results : [];
      const departures = Array.isArray(data?.departures) ? data.departures : [];
      flights = { arrivals, departures };
    }

    const departures = normalizeCommercialList(flights.departures || [], fallbackProvider, normalizedAirportCode);
    const arrivals = normalizeCommercialList(flights.arrivals || [], fallbackProvider, normalizedAirportCode);
    const payload = {
      provider,
      available: departures.length > 0 || arrivals.length > 0,
      airportCode: normalizedAirportCode,
      departures,
      arrivals,
      airport: aeroAirport?.available ? aeroAirport : context.airport || getAirportByCode(normalizedAirportCode) || null,
      message: departures.length || arrivals.length || aeroAirport?.available ? '' : 'Commercial schedule data is not available for this airport.',
    };
    if (payload.available) {
      lastSuccessfulFetchAt = Date.now();
      lastError = '';
    }
    analytics.recordCall('commercial', Date.now() - startedAt);
    setCached(cacheKey, payload);
    return payload;
  } catch (error) {
    analytics.recordFailure('commercial', error);
    lastError = safeText(error?.message || 'Commercial airport lookup failed.');
    cooldowns.set(cacheKey, Date.now() + COOLDOWN_MS);
    const stale = getStaleCached(cacheKey);
    if (stale) return stale;
    const unavailable = {
      provider,
      available: false,
      airportCode: normalizedAirportCode,
      arrivals: [],
      departures: [],
      message: lastError,
    };
    setCached(cacheKey, unavailable);
    return unavailable;
  }
  });
}

function buildCommercialRoute(liveAircraft, commercial) {
  if (commercial?.route?.available || commercial?.route?.from || commercial?.route?.to) {
    const route = commercial.route;
    const from = route.from;
    const to = route.to;
    const hasLivePosition =
      liveAircraft &&
      Number.isFinite(Number(liveAircraft.latitude)) &&
      Number.isFinite(Number(liveAircraft.longitude));
    const hasArrival = Number.isFinite(Number(to?.latitude)) && Number.isFinite(Number(to?.longitude));
    const hasDeparture = Number.isFinite(Number(from?.latitude)) && Number.isFinite(Number(from?.longitude));
    let remainingMinutes = null;
    let progressPercent = null;
    let remainingDistanceKm = null;

    if (hasLivePosition && hasArrival) {
      const current = { latitude: Number(liveAircraft.latitude), longitude: Number(liveAircraft.longitude) };
      const arrival = { latitude: Number(to.latitude), longitude: Number(to.longitude) };
      remainingDistanceKm = haversineKm(current, arrival);
      const speedKmh = Number(liveAircraft.velocity) * 3.6;
      if (speedKmh > 0) remainingMinutes = Math.max(1, Math.round((remainingDistanceKm / speedKmh) * 60));
      if (hasDeparture && Number(route.distanceKm) > 0) {
        progressPercent = Math.max(0, Math.min(99, Math.round(100 - (remainingDistanceKm / Number(route.distanceKm)) * 100)));
      }
    }

    return {
      from,
      to,
      progressPercent,
      remainingMinutes: remainingMinutes ?? route.durationMinutes ?? null,
      distanceKm: Math.round(remainingDistanceKm ?? route.distanceKm ?? 0) || null,
      approximate: true,
      provider: route.provider || commercial.provider,
    };
  }

  const arrivalCode = normalizeCode(commercial?.arrivalAirport?.code || commercial?.arrivalAirport?.icaoCode || '');
  const departureCode = normalizeCode(commercial?.departureAirport?.code || commercial?.departureAirport?.icaoCode || '');
  const arrivalAirport = getAirportByCode(arrivalCode);
  const departureAirport = getAirportByCode(departureCode);
  const hasLivePosition =
    liveAircraft &&
    Number.isFinite(Number(liveAircraft.latitude)) &&
    Number.isFinite(Number(liveAircraft.longitude));
  const hasSpeed = Number.isFinite(Number(liveAircraft?.velocity)) && Number(liveAircraft.velocity) > 0;
  if (!hasLivePosition || !hasSpeed || !arrivalAirport || !departureAirport) {
    return null;
  }

  const current = { latitude: Number(liveAircraft.latitude), longitude: Number(liveAircraft.longitude) };
  const arrival = { latitude: Number(arrivalAirport.latitude), longitude: Number(arrivalAirport.longitude) };
  const departure = { latitude: Number(departureAirport.latitude), longitude: Number(departureAirport.longitude) };
  const totalDistanceKm = haversineKm(departure, arrival);
  const remainingDistanceKm = haversineKm(current, arrival);
  const speedKmh = Number(liveAircraft.velocity) * 3.6;
  const remainingMinutes = speedKmh > 0 ? Math.max(1, Math.round((remainingDistanceKm / speedKmh) * 60)) : null;
  const progressPercent = totalDistanceKm > 0
    ? Math.max(0, Math.min(99, Math.round(100 - (remainingDistanceKm / totalDistanceKm) * 100)))
    : null;

  return {
    from: {
      code: departureAirport.airportCode,
      icaoCode: departureAirport.icaoCode,
      name: departureAirport.name,
      city: departureAirport.city,
      country: departureAirport.country,
      latitude: departureAirport.latitude,
      longitude: departureAirport.longitude,
    },
    to: {
      code: arrivalAirport.airportCode,
      icaoCode: arrivalAirport.icaoCode,
      name: arrivalAirport.name,
      city: arrivalAirport.city,
      country: arrivalAirport.country,
      latitude: arrivalAirport.latitude,
      longitude: arrivalAirport.longitude,
    },
    progressPercent,
    remainingMinutes,
    distanceKm: Math.round(remainingDistanceKm),
    approximate: true,
  };
}

function haversineKm(from, to) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = {
  lookupCommercialFlight,
  lookupCommercialAirportSchedule,
  getCommercialProviderConfig,
  getCommercialProviderStatus,
  buildCommercialRoute,
  __test: {
    __setLastError(value) {
      lastError = value;
    },
  },
};
