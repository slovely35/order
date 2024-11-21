// controllers/adminController.js
const Product = require('../models/Product');
const Order = require('../models/Order');

// 제품 목록 조회
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.render('adminDashboard', { products });
  } catch (error) {
    res.status(500).send('Error retrieving products');
  }
};

// 제품 수정
exports.editProduct = async (req, res) => {
  const { productId, name, category, price, stock } = req.body;
  try {
    await Product.findByIdAndUpdate(productId, { name, category, price, stock });
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.status(500).send('Error updating product');
  }
};

// 제품 삭제
exports.deleteProduct = async (req, res) => {
  const { productId } = req.body;
  try {
    await Product.findByIdAndDelete(productId);
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.status(500).send('Error deleting product');
  }
};

// 주문 리포트 조회
exports.getOrderReport = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('products.productId');
    res.render('adminDashboard', { orders });
  } catch (error) {
    res.status(500).send('Error retrieving order report');
  }
};
