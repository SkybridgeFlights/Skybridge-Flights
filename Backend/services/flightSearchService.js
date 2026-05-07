const { searchFlightsFromMongo } = require('./providers/mongoFlightSearchProvider');
const { searchFlightsFromAviasales } = require('./providers/aviasalesSearchProvider');
const { searchFlightsFromAmadeus } = require('./providers/amadeusSearchProvider');

async function searchFlights(params) {
  const provider = String(process.env.FLIGHT_SEARCH_PROVIDER || 'mongo').toLowerCase();

  if (provider === 'amadeus') {
    return searchFlightsFromAmadeus(params);
  }

  if (provider === 'aviasales') {
    return searchFlightsFromAviasales(params);
  }

  return searchFlightsFromMongo(params);
}

module.exports = {
  searchFlights,
};