const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Flight = require('./models/Flight');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Connection error:', err));

const seedFlights = async () => {
  await Flight.deleteMany(); // ❗احذف هذا السطر لو تريد الاحتفاظ بالبيانات السابقة

  const flights = [
    {
      from: 'BER',
      to: 'IST',
      date: '2025-08-01',
      airline: 'Lufthansa',
      price: 180,
      travelClass: 'Economy'
    },
    {
      from: 'BER',
      to: 'IST',
      date: '2025-08-01',
      airline: 'Turkish Airlines',
      price: 210,
      travelClass: 'Economy'
    }
  ];

  await Flight.insertMany(flights);
  console.log('✅ Test flights added');
  mongoose.disconnect();
};

seedFlights();