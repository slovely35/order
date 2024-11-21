// controllers/storeController.js
const Product = require('../models/Product');
const Order = require('../models/Order');

// 제품 목록 조회
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.render('storeDashboard', { products });
  } catch (error) {
    res.status(500).send('Error retrieving products');
  }
};

// 주문 생성
exports.createOrder = async (req, res) => {
  const { products } = req.body;
  const orderItems = products.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
  }));

  try {
    const order = new Order({
      userId: req.user._id,
      products: orderItems,
      totalAmount: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    });

    await order.save();
    res.redirect('/store/orders/history');
  } catch (error) {
    res.status(500).send('Error creating order');
  }
};

// 주문 기록 조회
exports.getOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).populate('products.productId');
    res.render('storeDashboard', { orders });
  } catch (error) {
    res.status(500).send('Error retrieving order history');
  }
};
