const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  stock: Number,
  image: String, // 이미지 경로 필드 추가
});

module.exports = mongoose.model('Product', productSchema);
