require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || '';

async function testConnection() {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📂 Collections:', collections.map(c => c.name));

    const flights = await mongoose.connection.db.collection('flights').find({}).limit(5).toArray();
    console.log('✈️ Sample flights:', flights);

    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  } catch (error) {
    console.error('❌ Connection error:', error);
  }
}

testConnection();