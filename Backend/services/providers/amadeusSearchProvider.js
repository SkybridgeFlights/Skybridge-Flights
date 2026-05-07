const axios = require('axios');

const AMADEUS_TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_SEARCH_URL = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

const AIRLINE_NAMES = {
  TK: 'Turkish Airlines',
  PC: 'Pegasus Airlines',
  LH: 'Lufthansa',
  QR: 'Qatar Airways',
  EK: 'Emirates',
  FZ: 'flydubai',
  SV: 'Saudia',
  MS: 'EgyptAir',
  BA: 'British Airways',
  AF: 'Air France',
  KL: 'KLM',
  AZ: 'ITA Airways',
  RJ: 'Royal Jordanian',
  EY: 'Etihad Airways',
  GF: 'Gulf Air',
  WY: 'Oman Air',
  KU: 'Kuwait Airways',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDate(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function toCode(value = '') {
  const match = String(value).match(/\(([A-Z]{3})\)/);
  return match ? match[1] : String(value).trim().toUpperCase();
}

function parseIsoDateTime(iso) {
  if (!iso) {
    return { date: '', time: '' };
  }

  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    const parts = String(iso).split('T');
    return {
      date: parts[0] || '',
      time: (parts[1] || '').slice(0, 5),
    };
  }

  return {
    date: dt.toISOString().slice(0, 10),
    time: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
  };
}

function parseDurationToMinutes(duration = '') {
  const match = String(duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  return hours * 60 + minutes;
}

function getAirlineName(code = '') {
  return AIRLINE_NAMES[code] || code || 'Unknown Airline';
}

function buildFlightKey({
  airlineCode,
  from,
  to,
  date,
  departureTime,
  arrivalTime,
  stops,
}) {
  return `${airlineCode || 'XX'}-${from}-${to}-${date}-${departureTime}-${arrivalTime}-${Number(stops || 0)}`;
}

function normalizeOffer(rawOffer, currency = 'EUR') {
  const itinerary = rawOffer?.itineraries?.[0];
  const segments = itinerary?.segments || [];

  if (!segments.length) {
    return null;
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  const departure = parseIsoDateTime(firstSegment?.departure?.at);
  const arrival = parseIsoDateTime(lastSegment?.arrival?.at);

  const airlineCode = firstSegment?.carrierCode || '';
  const from = firstSegment?.departure?.iataCode || '';
  const to = lastSegment?.arrival?.iataCode || '';
  const stops = Math.max(segments.length - 1, 0);

  const priceValue = Number(rawOffer?.price?.total || 0);
  const offerCurrency = rawOffer?.price?.currency || currency || 'EUR';
  const durationMinutes = parseDurationToMinutes(itinerary?.duration || '');

  return {
    flightKey: buildFlightKey({
      airlineCode,
      from,
      to,
      date: departure.date,
      departureTime: departure.time,
      arrivalTime: arrival.time,
      stops,
    }),
    airline: getAirlineName(airlineCode),
    airlineCode,
    from,
    to,
    date: departure.date,
    departureTime: departure.time,
    arrivalTime: arrival.time,
    durationMinutes,
    stops,
    direct: stops === 0,
    offers: [
      {
        providerKey: 'amadeus',
        providerName: 'Amadeus',
        price: priceValue,
        currency: offerCurrency,
        deepLink: '',
        isCheapest: true,
        isBest: true,
      },
    ],
  };
}

async function getAmadeusAccessToken() {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    const error = new Error('Amadeus API credentials are missing.');
    error.statusCode = 500;
    throw error;
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', apiKey);
  body.append('client_secret', apiSecret);

  const response = await axios.post(AMADEUS_TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 20000,
  });

  const token = response.data?.access_token;
  if (!token) {
    const error = new Error('Failed to get Amadeus access token.');
    error.statusCode = 502;
    throw error;
  }

  return token;
}

async function searchFlightsFromAmadeus(params) {
  const {
    from,
    to,
    date,
    adults = 1,
    children = 0,
    infants = 0,
    travelClass = 'ECONOMY',
    currency = 'EUR',
  } = params;

  if (!from || !to || !date) {
    const error = new Error('From, To and Departure Date are required');
    error.statusCode = 400;
    throw error;
  }

  const originLocationCode = toCode(from);
  const destinationLocationCode = toCode(to);
  const departureDate = normalizeDate(date);

  const token = await getAmadeusAccessToken();

  const response = await axios.get(AMADEUS_SEARCH_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      adults: Number(adults || 1),
      children: Number(children || 0),
      infants: Number(infants || 0),
      travelClass: String(travelClass || 'ECONOMY').replace(/\s+/g, '_').toUpperCase(),
      currencyCode: String(currency || 'EUR').toUpperCase(),
      nonStop: false,
      max: 20,
    },
    timeout: 25000,
  });

  const rawOffers = Array.isArray(response.data?.data) ? response.data.data : [];
  const flights = rawOffers.map((offer) => normalizeOffer(offer, currency)).filter(Boolean);

  if (!flights.length) {
    const error = new Error('No flights found for the selected dates.');
    error.statusCode = 404;
    throw error;
  }

  return {
    source: 'amadeus',
    searchMeta: {
      from,
      to,
      fromCode: originLocationCode,
      toCode: destinationLocationCode,
      date: departureDate,
      returnDate: '',
      adults: Number(adults || 1),
      children: Number(children || 0),
      infants: Number(infants || 0),
      travelClass: String(travelClass || 'Economy'),
      currency: String(currency || 'EUR'),
    },
    flights,
  };
}

module.exports = {
  searchFlightsFromAmadeus,
};