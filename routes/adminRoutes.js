// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const paginate = require('../middlewares/pagination');
const { isAdmin } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt'); // bcrypt 모듈 추가

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads'); // 업로드 경로
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // 고유 파일명 생성
  },
});

const upload = multer({ storage });

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

router.post('/products/add', upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const product = new Product({
      name,
      category,
      price,
      stock,
      image: imagePath, // 이미지 경로 저장
    });

    await product.save();
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Error adding product');
  }
});


// 정적 파일 제공 (이미지 접근용)
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

    // 현재 관리자 찾기
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    // 이메일 중복 체크
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: `The email "${newEmail}" is already in use.`,
      });
    }

    // 이메일만 업데이트
    await User.updateOne(
      { _id: admin._id },
      { $set: { email: newEmail } }
    );

    res.json({
      success: true,
      message: 'Admin email updated successfully!',
      email: newEmail,
    });
  } catch (error) {
    console.error('Error updating admin email:', error);

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the admin email.',
    });
  }
});



// 주문 세부 정보 조회 라우트
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId'); // 사용자 정보 포함
    if (!order) {
      return res.status(404).send('Order not found');
    }

    res.render('orderDetails', { order }); // 주문 세부 정보를 렌더링할 orderDetails.ejs로 전달
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Error fetching order details');
  }
});


// Update Store Email
router.post('/stores/update-email/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const store = await User.findByIdAndUpdate(id, { email }, { new: true });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    res.json({ success: true, message: 'Email updated successfully.' });
  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ success: false, message: 'An error occurred while updating email.' });
  }
});


// Reset Store Password
router.post('/stores/reset-password/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const store = await User.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    const newPassword = Math.random().toString(36).slice(-8); // Generate random password
    store.password = await bcrypt.hash(newPassword, 10);
    await store.save();

    // Send Email with New Password
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Admin" <${process.env.EMAIL_USER}>`,
      to: store.email,
      subject: 'Password Reset',
      text: `Your new password is: ${newPassword}`,
    });

    res.json({ success: true, message: 'Password reset email sent successfully.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'An error occurred while resetting password.' });
  }
});


router.post('/stores/reset-password/:storeId', async (req, res) => {
  try {
      const { storeId } = req.params;

      // Generate a random password
      const newPassword = Math.random().toString(36).slice(-8);

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password in the database
      const store = await User.findByIdAndUpdate(storeId, { password: hashedPassword });
      if (!store) {
          return res.status(404).json({ success: false, message: 'Store not found.' });
      }

      // Send the new password to the store via email
      const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: 465,
          secure: true,
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });

      await transporter.sendMail({
          from: `"Admin" <${process.env.EMAIL_USER}>`,
          to: store.email,
          subject: 'Password Reset',
          text: `Your new password is: ${newPassword}`,
      });

      res.status(200).json({ success: true, message: 'Password reset email sent successfully.' });
  } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ success: false, message: 'An error occurred while resetting password.' });
  }
});

// Update Store Password
router.post('/stores/update-password/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const store = await User.findByIdAndUpdate(id, { password: hashedPassword });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ success: false, message: 'An error occurred while updating password.' });
  }
});




module.exports = router;
