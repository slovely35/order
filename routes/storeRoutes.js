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
    
    // 장바구니 데이터 디버깅
    console.log('Cart:', cart);  // cart 객체의 내용을 출력하여 제대로 불러와졌는지 확인

    // 장바구니가 없거나, items 배열이 비어 있는 경우 처리
    if (!cart || !cart.items.length) {
      return res.render('storeCart', {
        title: 'Your Cart',
        cartItems: [],
        message: 'Your cart is empty.',
      });
    }

    // 장바구니 아이템 정보 가공
    const cartItems = cart.items.map(item => {
      // Check if productId exists
      const product = item.productId;
      const productName = product ? product.name : 'Unknown Product';
      const productPrice = product ? product.price : 0;

      console.log('Item:', item);  // 각 아이템 출력하여 productId가 잘 로드되었는지 확인
      return {
        name: productName,
        price: productPrice,
        quantity: item.quantity,
        subtotal: productPrice * item.quantity,
        productId: product ? product._id : null,
      };
    });

    res.render('storeCart', {
      title: 'Your Cart',
      cartItems,
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    
    // 오류 메시지 출력 (디버깅용)
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
      } else {
        console.error(`Invalid quantity for product ${productId}: ${quantity}`);
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
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) {
      throw new Error('Product not found in cart.');
    }

    cart.items.splice(itemIndex, 1);

    await cart.save();
    console.log(`Product ${productId} removed from cart for user ${userId}`);
    res.redirect('/store/cart'); // 장바구니 페이지로 리디렉션
  } catch (error) {
    console.error('Error removing product from cart:', error.message);
    res.status(400).send('Error removing product from cart: ' + error.message);
  }
});



router.post('/cart/update', isStoreAccount, async (req, res) => {
  const { quantities } = req.body;

  if (!quantities || Object.keys(quantities).length === 0) {
    return res.status(400).send('No products selected for update.');
  }

  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      throw new Error('Cart not found.');
    }

    cart.items = cart.items.map(item => {
      const newQuantity = quantities[item.productId] ? parseInt(quantities[item.productId], 10) : item.quantity;
      if (isNaN(newQuantity) || newQuantity <= 0) {
        console.error(`Invalid quantity for product ${item.productId}: ${newQuantity}`);
        return item; // 잘못된 수량은 수정하지 않음
      }
      return { ...item, quantity: newQuantity };
    });

    await cart.save();
    res.redirect('/store/cart'); // 장바구니 페이지로 리디렉션
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
