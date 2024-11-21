// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// 물건 리스트 페이지
router.get('/', productController.getAllProducts);

module.exports = router;
