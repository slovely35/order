// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  storeName: String,
  address: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'storeOwner'], default: 'storeOwner' } // 역할 필드 추가
});

module.exports = mongoose.model('User', userSchema);
