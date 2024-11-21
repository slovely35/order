// routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// 장바구니 페이지 보기
router.get('/', cartController.viewCart);

// 장바구니에 물건 추가
router.post('/add', cartController.addToCart);

// 장바구니에서 물건 제거
router.post('/remove', cartController.removeFromCart);

module.exports = router;
