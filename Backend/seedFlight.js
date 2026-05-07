const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Flight = require('./models/Flight');

dotenv.config();

const db = process.env.MONGO_URI;

if (!db) {
  console.error('MONGO_URI is required to run the flight seed script.');
  process.exit(1);
}

mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB for seeding flights...'))
  .catch((err) => console.error('❌ MongoDB connection failed:', err));

const flights = [];

// ---- بيانات أساسية ----
const airlines = ['Turkish Airlines', 'Lufthansa', 'Emirates', 'Qatar Airways', 'Skybridge Airlines'];
const fromAirports = ['Berlin Brandenburg Airport (BER)', 'Frankfurt Airport (FRA)', 'Munich Airport (MUC)'];
const toAirports = ['Istanbul Airport (IST)', 'Dubai International Airport (DXB)', 'Doha Hamad Airport (DOH)'];

// ---- دالة لإنشاء تواريخ شهر 8 ----
const generateDatesForAugust = () => {
  const dates = [];
  for (let day = 1; day <= 31; day++) {
    const formattedDay = day.toString().padStart(2, '0');
    dates.push(`2025-08-${formattedDay}`);
  }
  return dates;
};

const dates = generateDatesForAugust();

// ---- توليد رحلات ذهاب وإياب ----
dates.forEach(date => {
  fromAirports.forEach(from => {
    toAirports.forEach(to => {
      if (from !== to) {
        const randomAirline = airlines[Math.floor(Math.random() * airlines.length)];
        const flightNumberGo = `GO-${Math.floor(1000 + Math.random() * 9000)}`;
        const flightNumberReturn = `RT-${Math.floor(1000 + Math.random() * 9000)}`;
        const price = Math.floor(120 + Math.random() * 250);
        const departureTime = `${Math.floor(Math.random() * 10 + 6)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        const arrivalTime = `${Math.floor(Math.random() * 10 + 12)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        const seats = Array.from({ length: 80 }, (_, i) => `A${i + 1}`);

        // رحلة الذهاب
        flights.push({
          from,
          to,
          date,
          price,
          airline: randomAirline,
          flightNumber: flightNumberGo,
          departureTime,
          arrivalTime,
          duration: '3h 25m',
          class: 'Economy',
          availableSeats: seats,
        });

        // رحلة العودة
        flights.push({
          from: to,
          to: from,
          date,
          price: price + 30, // سعر أعلى قليلاً للعودة
          airline: randomAirline,
          flightNumber: flightNumberReturn,
          departureTime: `${Math.floor(Math.random() * 10 + 14)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          arrivalTime: `${Math.floor(Math.random() * 10 + 20)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          duration: '3h 15m',
          class: 'Economy',
          availableSeats: seats,
        });
      }
    });
  });
});

const seedFlights = async () => {
  try {
    await Flight.deleteMany({});
    console.log('🗑️ Old flights removed.');

    await Flight.insertMany(flights);
    console.log(`✈️ ${flights.length} flights for August added successfully!`);

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error seeding flights:', err);
    mongoose.connection.close();
  }
};

seedFlights();