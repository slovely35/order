const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { isStoreAccount } = require('../middlewares/authMiddleware');
const paginate = require('../middlewares/pagination');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// 전체 상품 페이지
router.get('/dashboard', isStoreAccount, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // 최신순 정렬
    res.render('storeDashboard', {
      title: 'Store Dashboard',
      products,
    });
  } catch (error) {
    console.error('Error loading store dashboard:', error);
    res.status(500).send('Error loading store dashboard');
  }
});

// 장바구니 페이지
router.get('/cart', isStoreAccount, async (req, res) => {
  const userId = req.user._id;

  try {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    // 장바구니가 없거나, items 배열이 비어 있는 경우 처리
    if (!cart || !cart.items.length) {
      return res.render('storeCart', {
        title: 'Your Cart',
        cartItems: [], // 장바구니에 아이템이 없으면 빈 배열 전달
        message: 'Your cart is empty.',
      });
    }

    // 장바구니 아이템 정보 가공
    const cartItems = cart.items.map(item => ({
      name: item.productId ? item.productId.name : 'Unknown Product',  // productId가 없는 경우 처리
      price: item.productId ? item.productId.price : 0, // 가격이 없는 경우 0으로 처리
      quantity: item.quantity,
      subtotal: (item.productId ? item.productId.price : 0) * item.quantity,
      productId: item.productId ? item.productId._id : null,
    }));

    res.render('storeCart', {
      title: 'Your Cart',
      cartItems,
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    
    // 오류 메시지 표시
    res.status(500).render('storeCart', {
      title: 'Your Cart',
      cartItems: [],
      message: 'Error loading cart. Please try again later.',
    });
  }
});


// 장바구니에 상품 추가
router.post('/cart/add', isStoreAccount, async (req, res) => {
  const userId = req.user._id;
  const { selectedProducts, quantities } = req.body;

  console.log('Full request body:', req.body);

  // 수량이 제대로 전달되었는지 확인
  const parsedQuantities = {};
  for (const productId in quantities) {
    const quantity = parseInt(quantities[productId], 10);
    if (!isNaN(quantity) && quantity > 0) {
      parsedQuantities[productId] = quantity;
    }
  }

  console.log('Parsed quantities:', parsedQuantities);

  if (selectedProducts.length === 0) {
    return res.status(400).send('No products selected.');
  }

  try {
    let cart = await Cart.findOne({ userId });

    // 장바구니가 없으면 새로 생성
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // 선택된 제품만 장바구니에 추가
    selectedProducts.forEach(productId => {
      const quantity = parsedQuantities[productId];
      if (quantity && !isNaN(quantity) && quantity > 0) {
        const existingItem = cart.items.find(item => item.productId.toString() === productId);
        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          cart.items.push({ productId, quantity });
        }
      }
    });

    await cart.save();
    console.log(`Products added to cart for user ${userId}`);
    res.redirect('/store/cart');
  } catch (error) {
    console.error('Error adding to cart:', error.message);
    res.status(400).send('Error adding to cart: ' + error.message);
  }
});


// 장바구니 물품 삭제
router.post('/cart/remove/:productId', isStoreAccount, async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      throw new Error('Cart not found.');
    }

    // 장바구니에서 해당 상품 제거
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    await cart.save();
    console.log(`Product ${productId} removed from cart for user ${userId}`);
    res.redirect('/store/cart'); // 장바구니 페이지로 리디렉션
  } catch (error) {
    console.error('Error removing product from cart:', error.message);
    res.status(400).send('Error removing product from cart: ' + error.message);
  }
});


router.post('/cart/update', isStoreAccount, async (req, res) => {
  try {
    const { quantities } = req.body;

    if (!quantities || Object.keys(quantities).length === 0) {
      return res.status(400).send('No products selected for update.');
    }

    // Update quantities in cart
    const cart = await Cart.findOne({ userId: req.user._id });

    cart.items = cart.items.map((item) => {
      const newQuantity = quantities[item.productId] ? parseInt(quantities[item.productId], 10) : item.quantity;
      return { ...item, quantity: newQuantity };
    });

    await cart.save();
    res.redirect('/store/cart'); // Refresh cart page
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).send('Error updating cart');
  }
});



// 주문 내역 페이지
router.get('/orders', isStoreAccount, async (req, res) => {
  try {
    // 주문 상태에 따른 데이터를 가져옵니다
    const orders = await Order.find({ storeId: req.user.storeId }).populate('products.productId');
    
    // 주문 내역을 렌더링할 때, products 대신 orders로 전달
    res.render('storeOrders', { orders });
} catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).send('Error fetching orders');
}
});

// 주문 상세 페이지
router.get('/orders/:orderId', isStoreAccount, async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).populate('products.productId');
    if (!order) {
      return res.status(404).send('Order not found');
    }

    res.render('orderDetails', { order });
  } catch (error) {
    console.error('Error loading order details:', error);
    res.status(500).send('Error loading order details');
  }
});


module.exports = router;
