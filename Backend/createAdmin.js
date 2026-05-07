// createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Staff = require('./models/Staff'); // تأكد من صحة المسار
require('dotenv').config();

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const hashedPassword = await bcrypt.hash('AdminSky123', 10); // يمكنك تغيير كلمة السر

  const admin = new Staff({
    name: 'Main Admin',
    email: 'info@skybridgeflights.com',
    role: 'admin',
    phone: '',
    active: true,
    password: hashedPassword,
  });

  try {
    await admin.save();
    console.log('✅ Admin created successfully');
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  } finally {
    mongoose.disconnect();
  }
}

createAdmin();