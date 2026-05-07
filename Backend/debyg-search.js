// debug-search.js
require('dotenv').config();
const mongoose = require('mongoose');
const Flight = require('./models/Flight');

const MONGO_URI = process.env.MONGO_URI;

async function runDebug() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB for debug');

    const from = 'Berlin Brandenburg Airport (BER)';
    const to = 'Istanbul Airport (IST)';
    const date = '2025-08-01';

    const flights = await Flight.find({ from, to, date });
    console.log(`🔍 Flights found for ${from} -> ${to} on ${date}:`, flights);

    if (flights.length === 0) {
      console.warn('⚠️ No flights found. Check DB data.');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Debug error:', err);
  }
}

runDebug();