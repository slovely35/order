// addAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // User 모델 경로 확인

require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const hashedPassword = await bcrypt.hash('2251lemoine', 10);
    const admin = new User({
      storeName: 'Admin Store',
      address: 'Admin Address',
      email: 'inquiry@101chicken.com',
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
    console.log('Admin account created');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error creating admin account:', error);
  }
}

createAdmin();
