const nodemailer = require('nodemailer');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // User 모델 추가

// 주문 확인 메일 전송 함수
async function sendOrderConfirmationEmail(orderDetails) {
  const storeOwner = await User.findById(orderDetails.userId);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 587,
    secure: false, // TLS
    auth: {
      user: process.env.EMAIL_USER, // 고정된 이메일 계정
      pass: process.env.EMAIL_PASS,
    },
  });

  const orderDate = new Date(); // 현재 날짜와 시간
  const orderDateFormatted = orderDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
  });

    const emailContent = `
    <h2>New Order Received</h2>
    <p><strong>Store Name:</strong> ${storeOwner.storeName}</p>
    <p><strong>Orderer Email:</strong> ${storeOwner.email}</p>
    <p><strong>Address:</strong> ${storeOwner.address.town}, ${storeOwner.address.state}, ${storeOwner.address.zipcode}</p>
    <p><strong>Order Date:</strong> ${orderDateFormatted}</p>
    <h3>Order Details:</h3>
    <ul>
      ${orderDetails.products
        .map(
          (item) =>
            `<li>${item.name} - ${item.quantity} pcs: $${item.subtotal.toFixed(2)}</li>`
        )
        .join('')}
    </ul>
    <p><strong>Total:</strong> $${orderDetails.totalAmount.toFixed(2)}</p>
  `;


  await transporter.sendMail({
    from: `"Order System" <${process.env.EMAIL_USER}>`, // 고정된 발신자 이메일
    to: process.env.ADMIN_EMAIL, // 관리자 이메일
    subject: `New Order from ${storeOwner.storeName}`,
    html: emailContent,
  });

  console.log('Order email sent successfully');
}

// 주문 생성 및 메일 전송
async function createOrder(req, res) {
  try {
    if (!req.session.cart || req.session.cart.length === 0) {
      console.error('Cart is empty');
      return res.redirect('/store/cart');
    }

    const cart = req.session.cart;
    const orderItems = await Promise.all(
      cart.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product || product.stock < item.quantity) {
          throw new Error(`Out of stock. Contact your manager`);
        }

        // 제품 재고 감소
        product.stock -= item.quantity;
        await product.save();

        return {
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          subtotal: product.price * item.quantity,
        };
      })
    );

    const totalAmount = orderItems.reduce((total, item) => total + item.subtotal, 0);

    // 주문 데이터베이스에 저장
    const order = new Order({
      userId: req.user._id, // 현재 로그인한 사용자 ID
      products: orderItems,
      totalAmount,
      status: 'Pending',
    });

    await order.save();

    // 주문 확인 메일 전송
    const orderDetails = {
      userId: req.user._id,
      totalAmount,
      products: orderItems,
    };
    await sendOrderConfirmationEmail(orderDetails);

    // 주문 완료 후 장바구니 비우기
    req.session.cart = [];

    res.render('orderDetail', { order });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).send('Error creating order');
  }
}

// 주문 내역 보기
async function viewOrders(req, res) {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 }) // 최신순 정렬
      .populate('products.productId');
    res.render('orderHistory', { orders });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Error fetching orders');
  }
}

module.exports = { createOrder, viewOrders };
