// controllers/productController.js
const Product = require('../models/Product');

// 모든 상품 조회
async function getAllProducts(req, res) {
  try {
    const products = await Product.find();
    res.render('productList', { products });
  } catch (err) {
    res.status(500).send('Error fetching products');
  }
}

module.exports = { getAllProducts };
