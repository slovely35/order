const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  category: String,
  name: String,
  image: String,
  price: Number,
  stock: Number,
});

module.exports = mongoose.model('Product', productSchema);
