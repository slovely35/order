const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  town: { type: String, required: true },
  state: { type: String, required: true },
  zipcode: { type: String, required: true },
});

const userSchema = new mongoose.Schema({
  storeName: { type: String, required: true },
  address: { type: addressSchema, required: true }, // 객체 형태의 주소
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'storeOwner'], default: 'storeOwner' },
});

// 이메일을 소문자로 변환하는 pre-save 미들웨어
userSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
