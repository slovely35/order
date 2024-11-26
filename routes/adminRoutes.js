// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const paginate = require('../middlewares/pagination');
const { isAdmin } = require('../middlewares/authMiddleware');

// 제품 목록 페이지 (페이지네이션 적용)
router.get('/products', isAdmin, paginate(Product, 50), (req, res) => {
    const { data: products, currentPage, totalPages } = res.paginatedData;
    res.render('adminProducts', { products, currentPage, totalPages });
  });

// 제품 수정
router.post('/products/edit', adminController.editProduct);

// 제품 삭제
router.post('/products/delete', adminController.deleteProduct);

// 가맹점 관리 페이지
router.get('/stores', isAdmin, async (req, res) => {
  try {
    const stores = await User.find({ role: 'storeOwner' }).sort({ createdAt: -1 }); // 최신순 정렬
    res.render('storeManagement', { 
      title: 'Store Management', // title 추가
      stores: stores.length > 0 ? stores : [], // 빈 배열 처리
    });
  } catch (error) {
    console.error('Error fetching store data:', error);
    res.status(500).send('Error loading store management');
  }
});

// 주문 관리 페이지
router.get('/orders', async (req, res) => {
    try {
      const orders = await Order.find().populate('userId');
      res.render('orderManagement', { orders });
    } catch (error) {
      res.status(500).send('Error fetching orders');
    }
  });

// 스토어 삭제 시 해당 스토어와 관련된 주문도 삭제하는 코드 예시
router.delete('/stores/:storeId', isAdmin, async (req, res) => {
  try {
    const storeId = req.params.storeId;

    // 해당 스토어의 주문 삭제
    await Order.deleteMany({ storeId: storeId });

    // 스토어 삭제
    await User.deleteOne({ _id: storeId, role: 'storeOwner' });

    res.status(200).send('Store and related orders deleted successfully');
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).send('Error deleting store');
  }
});

// 제품 관리 페이지
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const categoryFilter = req.query.category || null;
    const query = categoryFilter ? { category: categoryFilter } : {};
    const products = await Product.find(query).sort({ createdAt: -1 }); // 최신순 정렬
    const orders = await Order.find().populate('userId').sort({ createdAt: -1 }); // 최신순 정렬

    res.render('adminDashboard', { 
      title: 'Admin Dashboard', // title 추가
      products: products.length > 0 ? products : [],
      orders: orders.length > 0 ? orders : [],
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// 제품 등록 라우트
router.post('/products/add', async (req, res) => {
  try {
    const { name, category, price, stock, image } = req.body;

    const product = new Product({ name, category, price, stock, image });
    await product.save();

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Error adding product');
  }
});

// 관리자 설정 페이지
// adminRoutes.js
router.get('/settings', isAdmin, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id); // 현재 로그인한 관리자 정보 가져오기
    res.render('adminSettings', {
      title: 'Admin Settings',
      adminEmail: admin ? admin.email : 'Unknown', // 현재 이메일 전달
      successMessage: req.flash('successMessage'), // 성공 메시지
    });
  } catch (error) {
    console.error('Error loading admin settings:', error);
    res.status(500).send('Error loading admin settings');
  }
});

router.post('/settings/update-email', isAdmin, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const admin = await User.findById(req.user._id); // 현재 로그인한 관리자 정보 가져오기

    admin.email = newEmail; // 이메일 업데이트
    await admin.save();

    req.flash('successMessage', 'Email updated successfully!');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating admin email:', error);
    res.status(500).send('Error updating admin email');
  }
});

module.exports = router;
