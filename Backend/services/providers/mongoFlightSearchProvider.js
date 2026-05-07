const Flight = require('../../models/Flight');
const Provider = require('../../models/Provider');

function normalizeDate(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function toCode(value = '') {
  const match = String(value).match(/\(([A-Z]{3})\)/);
  return match ? match[1] : String(value).trim();
}

function parseDurationToMinutes(durationValue, departureTime, arrivalTime) {
  if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
    return durationValue;
  }

  if (typeof durationValue === 'string') {
    const str = durationValue.trim().toLowerCase();
    const hm = str.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);

    if (hm && (hm[1] || hm[2])) {
      const hours = Number(hm[1] || 0);
      const minutes = Number(hm[2] || 0);
      return hours * 60 + minutes;
    }

    if (/^\d+$/.test(str)) {
      return Number(str);
    }
  }

  if (departureTime && arrivalTime) {
    const dep = new Date(`1970-01-01T${departureTime}:00`);
    const arr = new Date(`1970-01-01T${arrivalTime}:00`);
    let diff = (arr - dep) / 60000;
    if (diff < 0) diff += 1440;
    return diff;
  }

  return 0;
}

function buildFlightKey(flight) {
  const airlineCode = flight.airlineCode || flight.airline || 'XX';
  const from = toCode(flight.from || '');
  const to = toCode(flight.to || '');
  const date = flight.date || '';
  const departureTime = flight.departureTime || '00:00';
  const arrivalTime = flight.arrivalTime || '00:00';
  const stops = Number(flight.stops || 0);

  return `${airlineCode}-${from}-${to}-${date}-${departureTime}-${arrivalTime}-${stops}`;
}

function buildOffersFromProviders(flight, providers = [], currency = 'EUR') {
  const basePrice = Number(flight.price || 0);

  const offers = providers.map((provider, index) => ({
    providerKey: provider.key,
    providerName: provider.name,
    price: basePrice + index * 7,
    currency,
    deepLink: '',
    isCheapest: false,
    isBest: false,
  }));

  const sorted = offers.sort((a, b) => a.price - b.price);

  return sorted.map((offer, index) => ({
    ...offer,
    isCheapest: index === 0,
    isBest: index === 0,
  }));
}

function normalizeFlight(flightDoc, providers = [], currency = 'EUR') {
  const flight = flightDoc.toObject ? flightDoc.toObject() : flightDoc;

  const stops = Number(flight.stops || 0);
  const durationMinutes = parseDurationToMinutes(
    flight.duration,
    flight.departureTime,
    flight.arrivalTime
  );

  return {
    flightKey: buildFlightKey(flight),
    airline: flight.airline || 'Unknown Airline',
    airlineCode: flight.airlineCode || '',
    from: toCode(flight.from || ''),
    to: toCode(flight.to || ''),
    date: flight.date || '',
    departureTime: flight.departureTime || '',
    arrivalTime: flight.arrivalTime || '',
    durationMinutes,
    stops,
    direct: stops === 0 || flight.direct === true,
    offers: buildOffersFromProviders(flight, providers, currency),
  };
}

async function searchFlightsFromMongo(params) {
  const {
    from,
    to,
    date,
    returnDate = '',
    adults = 1,
    children = 0,
    infants = 0,
    travelClass = 'Economy',
    currency = 'EUR',
  } = params;

  if (!from || !to || !date) {
    const error = new Error('From, To and Departure Date are required');
    error.statusCode = 400;
    throw error;
  }

  const departureDate = normalizeDate(date);

  const [outboundFlights, enabledProviders] = await Promise.all([
    Flight.find({
      from,
      to,
      date: departureDate,
    }).sort({ departureTime: 1 }),
    Provider.find({ enabled: true }).sort({ displayOrder: 1, createdAt: 1 }),
  ]);

  if (outboundFlights.length === 0) {
    const error = new Error('No flights found for the selected dates.');
    error.statusCode = 404;
    throw error;
  }

  return {
    source: 'mongo',
    searchMeta: {
      from,
      to,
      fromCode: toCode(from),
      toCode: toCode(to),
      date: departureDate,
      returnDate: returnDate ? normalizeDate(returnDate) : '',
      adults: Number(adults || 1),
      children: Number(children || 0),
      infants: Number(infants || 0),
      travelClass: String(travelClass || 'Economy'),
      currency: String(currency || 'EUR'),
    },
    flights: outboundFlights.map((flight) =>
      normalizeFlight(flight, enabledProviders, String(currency || 'EUR'))
    ),
  };
}

module.exports = {
  searchFlightsFromMongo,
};