const assert = require('assert');

const flightTrackerRoutes    = require('../routes/flightTrackerRoutes');
const flightTrackerController = require('../controllers/flightTrackerController');
const trackerService          = require('../services/flightTrackerService');
const fr24Service             = require('../services/flightRadar24Service');
const aeroDataBoxService      = require('../services/aeroDataBoxService');
const aggregator              = require('../services/flightTrackerProviderAggregator');

// ── Helpers ────────────────────────────────────────────────────────────────────

function routeExists(path, method) {
  return flightTrackerRoutes.stack.some((layer) => {
    const route = layer.route;
    return route && route.path === path && route.methods[String(method).toLowerCase()];
  });
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

async function invoke(handler, { params = {}, query = {} } = {}) {
  const req = { params, query };
  const res = createMockRes();
  await handler(req, res);
  return res;
}

function makeMockOpenSkyState() {
  return {
    time: 1710000000,
    source: 'mock-opensky',
    states: [
      ['abc123', 'SBR123', 'Germany', 1710000000, 1710000001, 13.52, 52.37, 8500, false, 220, 92, 0, null, 8700, '1200', false, 0, 6],
      ['def456', 'SBR456', 'Turkey',  1710000000, 1710000002, 28.75, 41.25, 0,    true,  0,   0,  0, null, 0,    '7000', false, 0, 2],
    ],
  };
}

// ── Route existence ────────────────────────────────────────────────────────────

function testRoutes() {
  assert(routeExists('/live',               'get'), 'route /live missing');
  assert(routeExists('/aircraft/:icao24',   'get'), 'route /aircraft/:icao24 missing');
  assert(routeExists('/search',             'get'), 'route /search missing');
  assert(routeExists('/airport/:airportCode','get'),'route /airport/:airportCode missing');
  assert(routeExists('/health',             'get'), 'route /health missing');
  assert(routeExists('/providers/health',   'get'), 'route /providers/health missing');
  assert(routeExists('/flights/:flightId',  'get'), 'route /flights/:flightId missing');
  assert(routeExists('/track/:flightId',    'get'), 'route /track/:flightId missing');
  console.log('  ✓ all routes present');
}

// ── OpenSky service (existing coverage) ───────────────────────────────────────

async function testOpenSkyService() {
  trackerService.__test.__setMockState(makeMockOpenSkyState());

  const live = await trackerService.getLiveAircraft({ region: 'germany', limit: 10 });
  assert(Array.isArray(live.aircraft), 'live aircraft should be an array');
  assert.strictEqual(live.aircraft[0].icao24, 'abc123', 'should retain ICAO24');
  assert.strictEqual(typeof live.summary.totalAircraft, 'number', 'summary should be present');

  const search = await trackerService.searchAircraft('SBR123', { region: 'germany', limit: 10 });
  assert(search.totalMatches >= 1, 'search should match callsign');
  assert(search.selectedAircraft,  'search should return a selected aircraft');
  assert.strictEqual(search.commercial.provider, 'none', 'commercial should fall back to none');
  assert.strictEqual(search.dataAvailability.hasLivePosition, true, 'should report live position');
  assert.strictEqual(search.dataAvailability.hasCommercialSchedule, false, 'no commercial without provider');

  const aircraft = await trackerService.getAircraftByIcao24('abc123', { region: 'germany' });
  assert(aircraft.aircraft, 'lookup should return a match');
  assert.strictEqual(aircraft.aircraft.callsign, 'SBR123', 'callsign should normalize');
  assert(aircraft.dataAvailability.hasLivePosition, 'should expose live position');

  const airport = await trackerService.getAirportSnapshot('BER', { limit: 10 });
  assert.strictEqual(airport.airportCode, 'BER', 'airport code should match');
  assert(Array.isArray(airport.aircraft), 'airport should include aircraft array');
  assert(airport.commercial, 'should include commercial wrapper');
  assert.strictEqual(airport.commercial.available, false, 'commercial should fail gracefully');

  const health = await trackerService.getHealth();
  assert(health.supportedAirports.includes('BER'), 'health should list BER');
  assert(health.commercialProviderStatus, 'health should expose commercial status');

  console.log('  ✓ OpenSky service');
}

// ── FR24 normalizer unit tests ─────────────────────────────────────────────────

function testFr24Normalizers() {
  const { normalizeFr24LiveItem, normalizeFr24DetailsItem, normalizeFr24TrackPoint } = fr24Service.__test;

  // Live item
  const live = normalizeFr24LiveItem({
    hex: 'ABC123',
    call: 'DLH123',
    lat: 52.37,
    lon: 13.52,
    alt: 27887,       // feet → ~8500 m
    spd: 430,         // knots → ~221 m/s
    track: 92,
    vspd: 0,
    gnd: false,
    sqk: '1200',
    orig_country: 'Germany',
    ac_type: 'A320',
    reg: 'D-AIBL',
    flight: 'LH123',
  });
  assert.strictEqual(live.icao24, 'abc123', 'icao24 should be lowercase');
  assert.strictEqual(live.callsign, 'DLH123', 'callsign from FR24');
  assert.strictEqual(live.onGround, false, 'onGround from gnd field');
  assert(live.baroAltitude > 8000 && live.baroAltitude < 9000, 'altitude conversion ft→m');
  assert(live.velocity > 200 && live.velocity < 250, 'speed conversion kts→m/s');
  assert.strictEqual(live.source, 'flightradar24', 'source tag');

  // Details item
  const details = normalizeFr24DetailsItem({
    identification: { id: 'FR-123456', number: { default: 'LH456' }, callsign: 'DLH456' },
    aircraft: { registration: 'D-ABCD', model: { code: 'B738', text: 'Boeing 737-800' } },
    airline: { name: 'Lufthansa', code: { iata: 'LH' } },
    airport: {
      origin:      { code: { iata: 'FRA', icao: 'EDDF' }, name: 'Frankfurt' },
      destination: { code: { iata: 'LHR', icao: 'EGLL' }, name: 'Heathrow' },
    },
    status: { text: 'en-route' },
  }, 'FR-123456');
  assert.strictEqual(details.flightId, 'FR-123456', 'flightId from identification');
  assert.strictEqual(details.flightNumber, 'LH456', 'flightNumber');
  assert.strictEqual(details.registration, 'D-ABCD', 'registration');
  assert.strictEqual(details.departureAirport.code, 'FRA', 'dep airport code');
  assert.strictEqual(details.arrivalAirport.code, 'LHR', 'arr airport code');
  assert.strictEqual(details.status, 'en-route', 'status text');
  assert.strictEqual(details.available, true, 'available flag');
  assert.strictEqual(details.source, 'flightradar24', 'source tag');

  // Track point
  const point = normalizeFr24TrackPoint({ ts: 1710000000, lat: 52.37, lon: 13.52, alt: 27887, spd: 430, hd: 92, gnd: false });
  assert.strictEqual(point.timestamp, 1710000000, 'timestamp');
  assert(point.altitude > 8000, 'altitude conversion');
  assert(point.speed > 200,    'speed conversion');

  console.log('  ✓ FR24 normalizers');
}

// ── FR24 bounds conversion ────────────────────────────────────────────────────

function testFr24BoundsConversion() {
  const { toBoundsStr, looksLikeFr24Id } = fr24Service.__test;

  // Internal bbox uses lamin(S), lomin(W), lamax(N), lomax(E).
  // FR24 expects "north,south,west,east".
  const europe = toBoundsStr({ lamin: 34, lomin: -12, lamax: 65, lomax: 40 });
  assert.strictEqual(europe, '65,34,-12,40', 'Europe bounds: N,S,W,E order');

  const germany = toBoundsStr({ lamin: 46.5, lomin: 5, lamax: 55.5, lomax: 16.5 });
  assert.strictEqual(germany, '55.5,46.5,5,16.5', 'Germany bounds: N,S,W,E order');

  const global_ = toBoundsStr({ lamin: -60, lomin: -180, lamax: 75, lomax: 180 });
  assert.strictEqual(global_, '75,-60,-180,180', 'Global bounds: N,S,W,E order');

  // looksLikeFr24Id should reject 6-char hex (ICAO24 addresses)
  assert.strictEqual(looksLikeFr24Id('abc123'), false, '6-char hex is ICAO24, not FR24 id');
  assert.strictEqual(looksLikeFr24Id('3c4516'), false, '6-char hex is ICAO24, not FR24 id');
  assert.strictEqual(looksLikeFr24Id('DLH123'), true,  'callsign is valid FR24 id');
  assert.strictEqual(looksLikeFr24Id('LH456'),  true,  'flight number is valid FR24 id');
  assert.strictEqual(looksLikeFr24Id('325da161ab123456'), true, 'long hex is FR24 flight id, not ICAO24');
  assert.strictEqual(looksLikeFr24Id(''),        false, 'empty string is invalid');

  console.log('  ✓ FR24 bounds conversion N,S,W,E and ICAO24 guard');
}

// ── FR24 service unavailable path ─────────────────────────────────────────────

async function testFr24UnconfiguredPath() {
  // Without a key the service should return available:false gracefully.
  const savedKey = process.env.FLIGHTRADAR24_API_KEY;
  delete process.env.FLIGHTRADAR24_API_KEY;

  const live    = await fr24Service.getLivePositions({ lamin: 47, lomin: 5, lamax: 55, lomax: 15 });
  assert.strictEqual(live.available, false, 'live should be unavailable without key');
  assert(live.error, 'live should include error message');

  const details = await fr24Service.getFlightDetails('FR-FAKE');
  assert.strictEqual(details.available, false, 'details should be unavailable without key');

  const track = await fr24Service.getFlightTrack('FR-FAKE');
  assert.strictEqual(track.available, false, 'track should be unavailable without key');

  if (savedKey) process.env.FLIGHTRADAR24_API_KEY = savedKey;
  console.log('  ✓ FR24 graceful unavailable path');
}

// ── FR24 no-key-leakage check ─────────────────────────────────────────────────

function testNoKeyLeakage() {
  const dummyKey = 'super-secret-fr24-key-12345';
  process.env.FLIGHTRADAR24_API_KEY = dummyKey;

  const status = fr24Service.getProviderStatus();
  const statusStr = JSON.stringify(status);
  assert(!statusStr.includes(dummyKey), 'API key must not appear in provider status');
  assert(status.configured === true, 'configured should be true when key is set');

  delete process.env.FLIGHTRADAR24_API_KEY;
  console.log('  ✓ No key leakage in provider status');
}

function testAeroDataBoxNormalizers() {
  const { normalizeFlight, normalizeRoute, selectSearchBy } = aeroDataBoxService.__test;
  const flight = normalizeFlight({
    number: 'LH 123',
    callSign: 'DLH123',
    status: 'EnRoute',
    departure: {
      airport: { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt Airport', location: { lat: 50.0379, lon: 8.5622 } },
      scheduledTime: { utc: '2026-05-10T08:00:00Z' },
      terminal: '1',
      gate: 'A12',
    },
    arrival: {
      airport: { iata: 'BER', icao: 'EDDB', name: 'Berlin Brandenburg Airport', location: { lat: 52.3667, lon: 13.5033 } },
      scheduledTime: { utc: '2026-05-10T09:00:00Z' },
      revisedTime: { utc: '2026-05-10T09:10:00Z' },
    },
    aircraft: { reg: 'D-AIBL', modeS: '3c6444', model: 'Airbus A319' },
    airline: { name: 'Lufthansa', iata: 'LH', icao: 'DLH' },
    greatCircleDistance: { km: 431 },
  }, 'DLH123', { liveAircraft: { callsign: 'DLH123', icao24: '3c6444' } });

  assert.strictEqual(flight.provider, 'aerodatabox', 'AeroDataBox flight provider tag');
  assert.strictEqual(flight.flightNumber, 'LH123', 'flight number should normalize');
  assert.strictEqual(flight.airline, 'Lufthansa', 'airline should normalize');
  assert.strictEqual(flight.departureAirport.code, 'FRA', 'departure airport should normalize');
  assert.strictEqual(flight.arrivalAirport.code, 'BER', 'arrival airport should normalize');
  assert.strictEqual(flight.aircraftType, 'Airbus A319', 'aircraft model should normalize');
  assert(flight.matchingConfidence >= 0.9, 'matching confidence should be high for callsign/icao match');

  const route = normalizeRoute({
    from: { iata: 'FRA', icao: 'EDDF', location: { lat: 50.0379, lon: 8.5622 } },
    to: { iata: 'BER', icao: 'EDDB', location: { lat: 52.3667, lon: 13.5033 } },
    greatCircleDistance: { km: 431 },
    approxFlightTime: '01:05:00',
  });
  assert.strictEqual(route.distanceKm, 431, 'route distance should normalize');
  assert.strictEqual(route.durationMinutes, 65, 'route duration should normalize');
  assert.strictEqual(selectSearchBy('3c6444'), 'icao24', 'icao24 search selector');

  const savedKey = process.env.AERODATABOX_API_KEY;
  process.env.AERODATABOX_API_KEY = 'secret-aerodatabox-key';
  const status = aeroDataBoxService.getProviderStatus();
  assert(!JSON.stringify(status).includes('secret-aerodatabox-key'), 'AeroDataBox key must not leak in status');
  if (savedKey) process.env.AERODATABOX_API_KEY = savedKey;
  else delete process.env.AERODATABOX_API_KEY;

  console.log('  ✓ AeroDataBox normalizers and status safety');
}

// ── Aggregator routes through opensky when FR24 not configured ────────────────

async function testAggregatorFallback() {
  trackerService.__test.__setMockState(makeMockOpenSkyState());
  delete process.env.FLIGHTRADAR24_API_KEY;
  delete process.env.FLIGHT_TRACKER_PRIMARY_PROVIDER;

  const live = await aggregator.getLiveAircraft({ region: 'germany', limit: 10 });
  assert(Array.isArray(live.aircraft), 'aggregator live should return aircraft array');
  assert(String(live.aggregator || '').startsWith('opensky'), 'aggregator tag should indicate opensky path');

  const search = await aggregator.searchAircraft('SBR123', { region: 'germany' });
  assert(search.totalMatches >= 0, 'aggregator search should return results without crash');

  const details = await aggregator.getFlightDetails('FAKE-ID');
  assert.strictEqual(details.available, false, 'aggregator details should report unavailable without FR24 key');

  const track = await aggregator.getFlightTrack('FAKE-ID');
  assert.strictEqual(track.available, false, 'aggregator track should report unavailable without FR24 key');

  console.log('  ✓ Aggregator falls back to OpenSky gracefully');
}

// ── Controller HTTP layer ─────────────────────────────────────────────────────

async function testControllers() {
  trackerService.__test.__setMockState(makeMockOpenSkyState());

  const liveRes = await invoke(flightTrackerController.getLive, { query: { region: 'germany', limit: '10' } });
  assert.strictEqual(liveRes.statusCode, 200, 'live controller 200');
  assert.strictEqual(liveRes.payload.success, true, 'live controller success');

  const searchRes = await invoke(flightTrackerController.search, { query: { query: 'SBR123' } });
  assert.strictEqual(searchRes.statusCode, 200, 'search controller 200');
  assert(searchRes.payload.totalMatches >= 1, 'search controller returns matches');

  const searchMissingRes = await invoke(flightTrackerController.search, { query: {} });
  assert.strictEqual(searchMissingRes.statusCode, 400, 'search without query → 400');

  const airportRes = await invoke(flightTrackerController.getAirport, { params: { airportCode: 'BER' } });
  assert.strictEqual(airportRes.statusCode, 200, 'airport controller 200');
  assert.strictEqual(airportRes.payload.airportCode, 'BER', 'airport code in response');

  const healthRes = await invoke(flightTrackerController.getHealth);
  assert.strictEqual(healthRes.statusCode, 200, 'health controller 200');
  assert.strictEqual(healthRes.payload.success, true, 'health controller success');

  const providersRes = await invoke(flightTrackerController.getProvidersHealth);
  assert.strictEqual(providersRes.statusCode, 200, 'providers health controller 200');
  assert(providersRes.payload.providers, 'providers health includes providers key');

  const detailsMissingRes = await invoke(flightTrackerController.getFlightDetails, { params: {} });
  assert.strictEqual(detailsMissingRes.statusCode, 400, 'details without id → 400');

  const trackMissingRes = await invoke(flightTrackerController.getFlightTrack, { params: {} });
  assert.strictEqual(trackMissingRes.statusCode, 400, 'track without id → 400');

  console.log('  ✓ Controller HTTP layer');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Running flight tracker smoke tests…');

  testRoutes();
  await testOpenSkyService();
  testFr24Normalizers();
  testFr24BoundsConversion();
  await testFr24UnconfiguredPath();
  testNoKeyLeakage();
  testAeroDataBoxNormalizers();
  await testAggregatorFallback();
  await testControllers();

  trackerService.__test.__setMockState(null);
  console.log('\nFlight tracker smoke tests passed ✓');
}

main().catch((error) => {
  console.error('\nSmoke test failed:', error);
  trackerService.__test.__setMockState(null);
  process.exit(1);
});
