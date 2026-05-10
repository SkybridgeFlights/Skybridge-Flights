const AIRPORTS = {
  BER: {
    airportCode: 'BER',
    icaoCode: 'EDDB',
    name: 'Berlin Brandenburg Airport',
    city: 'Berlin',
    country: 'Germany',
    latitude: 52.3667,
    longitude: 13.5033,
    radiusKm: 55,
    region: 'germany',
    transferTips: [
      'Allow extra time for rail and taxi connections during peak business hours.',
      'Compare airport transfer options with hotel check-in timing before booking a late arrival.',
    ],
    baggageTips: [
      'Check airline baggage rules before travel because short-haul and long-haul fares often differ.',
      'If you are connecting onward, keep cabin baggage compact for faster terminal changes.',
    ],
    relatedRoutes: ['Germany to Turkey', 'Berlin to Dubai', 'Berlin to Beirut'],
  },
  FRA: {
    airportCode: 'FRA',
    icaoCode: 'EDDF',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    latitude: 50.0379,
    longitude: 8.5622,
    radiusKm: 65,
    region: 'germany',
    transferTips: [
      'Frankfurt is a major hub, so connection time matters more than a tiny fare difference.',
      'Use Skybridge travel services when the itinerary needs hotel or car rental coordination.',
    ],
    baggageTips: [
      'Hub airports can mean long walks between gates, so keep hand baggage light if you are connecting.',
      'Review baggage allowances carefully on mixed-airline itineraries.',
    ],
    relatedRoutes: ['Germany to Turkey', 'Frankfurt to Dubai', 'Frankfurt to Beirut'],
  },
  MUC: {
    airportCode: 'MUC',
    icaoCode: 'EDDM',
    name: 'Munich Airport',
    city: 'Munich',
    country: 'Germany',
    latitude: 48.3538,
    longitude: 11.7861,
    radiusKm: 55,
    region: 'germany',
    transferTips: ['Plan extra time in winter conditions and during family travel peaks.'],
    baggageTips: ['A direct flight can be worth more here when traveling with larger baggage.'],
    relatedRoutes: ['Munich to Istanbul', 'Munich to Dubai', 'Munich to Beirut'],
  },
  IST: {
    airportCode: 'IST',
    icaoCode: 'LTFM',
    name: 'Istanbul Airport',
    city: 'Istanbul',
    country: 'Turkey',
    latitude: 41.2753,
    longitude: 28.7519,
    radiusKm: 70,
    region: 'europe',
    transferTips: ['Connections at Istanbul often benefit from generous transfer windows.'],
    baggageTips: ['Verify baggage and transit rules if you are continuing to the Middle East.'],
    relatedRoutes: ['Germany to Turkey', 'Istanbul to Beirut', 'Istanbul to Dubai'],
  },
  AYT: {
    airportCode: 'AYT',
    icaoCode: 'LTAI',
    name: 'Antalya Airport',
    city: 'Antalya',
    country: 'Turkey',
    latitude: 36.8987,
    longitude: 30.8005,
    radiusKm: 45,
    region: 'turkey',
    transferTips: ['Antalya arrivals can move quickly, but summer queues can still lengthen transfer times.'],
    baggageTips: ['Check seasonal charter baggage allowances carefully before booking.'],
    relatedRoutes: ['Germany to Turkey', 'Istanbul to Antalya', 'Dubai to Antalya'],
  },
  SAW: {
    airportCode: 'SAW',
    icaoCode: 'LTFJ',
    name: 'Sabiha Gokcen Airport',
    city: 'Istanbul',
    country: 'Turkey',
    latitude: 40.8986,
    longitude: 29.3092,
    radiusKm: 45,
    region: 'europe',
    transferTips: ['South-side Istanbul travelers should plan ground transfer time carefully.'],
    baggageTips: ['Budget fares can be strong here, but baggage fees change the real trip price.'],
    relatedRoutes: ['Berlin to Istanbul', 'Munich to Istanbul', 'Frankfurt to Istanbul'],
  },
  DXB: {
    airportCode: 'DXB',
    icaoCode: 'OMDB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    latitude: 25.2532,
    longitude: 55.3657,
    radiusKm: 60,
    region: 'middle-east',
    transferTips: ['Dubai trips often need a hotel, transfer, or car rental decision soon after landing.'],
    baggageTips: ['Check cabin and checked baggage rules when booking family-friendly fares.'],
    relatedRoutes: ['Germany to Dubai', 'Dubai to Beirut', 'Europe to Dubai'],
  },
  BEY: {
    airportCode: 'BEY',
    icaoCode: 'OLBA',
    name: 'Beirut Rafic Hariri International Airport',
    city: 'Beirut',
    country: 'Lebanon',
    latitude: 33.8209,
    longitude: 35.4884,
    radiusKm: 40,
    region: 'middle-east',
    transferTips: ['Beirut arrivals can benefit from pre-booked airport transfer planning.'],
    baggageTips: ['Keep document checks and baggage rules in mind when flying via regional hubs.'],
    relatedRoutes: ['Germany to Beirut', 'Dubai to Beirut', 'Istanbul to Beirut'],
  },
  LHR: {
    airportCode: 'LHR',
    icaoCode: 'EGLL',
    name: 'London Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    latitude: 51.47,
    longitude: -0.4543,
    radiusKm: 65,
    region: 'europe',
    transferTips: ['Heathrow transfers are easier when terminal and rail timing are checked before arrival.'],
    baggageTips: ['Allow extra time for baggage reclaim and terminal changes at this large hub.'],
    relatedRoutes: ['London to Frankfurt', 'London to Dubai', 'London to Istanbul'],
  },
};

const REGION_BOUNDS = {
  global: { lamin: -60, lomin: -180, lamax: 75, lomax: 180 },
  germany: { lamin: 46.5, lomin: 5.0, lamax: 55.5, lomax: 16.5 },
  europe: { lamin: 34.0, lomin: -12.0, lamax: 65.0, lomax: 40.0 },
  turkey: { lamin: 35.0, lomin: 25.0, lamax: 43.8, lomax: 45.5 },
  'middle-east': { lamin: 15.0, lomin: 30.0, lamax: 43.0, lomax: 63.0 },
  asia: { lamin: -10.0, lomin: 45.0, lamax: 78.0, lomax: 180.0 },
  africa: { lamin: -35.0, lomin: -20.0, lamax: 38.0, lomax: 55.0 },
  north_america: { lamin: 5.0, lomin: -170.0, lamax: 72.0, lomax: -50.0 },
  south_america: { lamin: -56.0, lomin: -82.0, lamax: 13.0, lomax: -34.0 },
  oceania: { lamin: -48.0, lomin: 110.0, lamax: 0.0, lomax: 180.0 },
};

const DEFAULT_CENTER = {
  global: [25, 20],
  germany: [51.2, 10.3],
  europe: [48.5, 12.5],
  turkey: [39.0, 35.5],
  'middle-east': [31.5, 44.0],
  asia: [34.0, 95.0],
  africa: [2.0, 20.0],
  north_america: [45.0, -100.0],
  south_america: [-15.0, -60.0],
  oceania: [-25.0, 135.0],
};

const REGION_LABELS = {
  global: 'Worldwide',
  germany: 'Germany',
  europe: 'Europe',
  turkey: 'Turkey',
  'middle-east': 'Middle East',
  asia: 'Asia',
  africa: 'Africa',
  north_america: 'North America',
  south_america: 'South America',
  oceania: 'Oceania',
};

function getAirportByCode(code = '') {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return null;
  return (
    AIRPORTS[value] ||
    Object.values(AIRPORTS).find((airport) => airport.icaoCode === value || airport.airportCode === value) ||
    null
  );
}

function getAirportCodes() {
  return Object.values(AIRPORTS).map((airport) => airport.airportCode);
}

function getRegionBounds(region = 'global') {
  return REGION_BOUNDS[region] || REGION_BOUNDS.global;
}

function getRegionCenter(region = 'global') {
  return DEFAULT_CENTER[region] || DEFAULT_CENTER.global;
}

module.exports = {
  AIRPORTS,
  DEFAULT_CENTER,
  REGION_BOUNDS,
  REGION_LABELS,
  getAirportByCode,
  getAirportCodes,
  getRegionBounds,
  getRegionCenter,
};
