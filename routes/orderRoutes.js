require('dotenv').config();
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const isStoreAccount = require('../middlewares/authMiddleware').isStoreAccount;
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 주문 번호 형식 지정 함수
function formatOrderNumber(orderNumber) {
    if (!orderNumber) {
        console.error('Invalid order number:', orderNumber);
        return '';
    }
    return `ORD-${orderNumber.toString().padStart(5, '0')}`;
}

// 주문 번호 자동 생성 함수
async function generateOrderNumber() {
    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    const lastOrderNumber = lastOrder ? lastOrder.orderNumber : 0;
    return lastOrderNumber + 1;
}

// 주문 생성
router.post('/checkout', isStoreAccount, async (req, res) => {
    try {
        const { selectedProducts, quantities } = req.body;

        console.log('Request Data:', { selectedProducts, quantities });

        // 데이터 유효성 검사
        if (!selectedProducts || !Array.isArray(selectedProducts) || selectedProducts.length === 0) {
            return res.status(400).json({ success: false, message: 'No products selected for checkout.' });
        }

        if (!quantities || typeof quantities !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid quantities provided.' });
        }

        const products = await Product.find({ _id: { $in: selectedProducts } });
        if (!products || products.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid products selected.' });
        }

        if (!req.user || !req.user._id) {
            throw new Error('User authentication is required.');
        }

        let totalAmount = 0;
        const insufficientStockProducts = [];
        const orderItems = [];

        for (const product of products) {
            const quantity = parseInt(quantities[product._id], 10);
            if (!quantity || quantity <= 0 || quantity > product.stock) {
                insufficientStockProducts.push(product.name);
                continue;
            }

            const subtotal = product.price * quantity;
            totalAmount += subtotal;

            product.stock -= quantity;
            await product.save();

            orderItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity,
                subtotal,
            });
        }

        if (insufficientStockProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock for: ${insufficientStockProducts.join(', ')}`,
            });
        }

        const user = await User.findById(req.user._id);
        if (!user || !user.address) {
            throw new Error('User or address information is missing.');
        }

        const admin = await User.findOne({ role: 'admin' });
        if (!admin || !admin.email) {
            throw new Error('Admin email not found.');
        }

        const orderNumber = await generateOrderNumber();
        const order = new Order({
            orderNumber,
            userId: req.user._id,
            products: orderItems,
            totalAmount,
        });
        await order.save();

        await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });

        const orderDateFormatted = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const emailContent = `
            <h2>New Order Received</h2>
            <p><strong>Store Name:</strong> ${user.storeName}</p>
            <p><strong>Address:</strong> ${user.address.town || 'N/A'}, ${user.address.state || 'N/A'}, ${user.address.zipcode || 'N/A'}</p>
            <p><strong>Order Date:</strong> ${orderDateFormatted}</p>
            <h3>Order Details:</h3>
            <table>
                <tr><th>Product</th><th>Quantity</th><th>Subtotal</th></tr>
                ${orderItems
                    .map(
                        (item) => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>$${item.subtotal.toFixed(2)}</td>
                    </tr>
                `
                    )
                    .join('')}
            </table>
            <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
        `;

        const pdfFilePath = path.join(__dirname, 'order.pdf');
        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(emailContent);
            await page.pdf({ path: pdfFilePath, format: 'A4' });
            await browser.close();
        } catch (pdfError) {
            console.error('Error generating PDF:', pdfError);
        }

        try {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Order System" <${process.env.EMAIL_USER}>`,
                to: admin.email, // 관리자 이메일
                subject: `New Order from ${user.storeName}`,
                html: emailContent,
                attachments: [
                    {
                        filename: 'order.pdf',
                        path: pdfFilePath,
                    },
                ],
            });

            console.log('Order email sent successfully.');
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        if (fs.existsSync(pdfFilePath)) {
            fs.unlinkSync(pdfFilePath);
        }

        res.status(200).json({ success: true, message: 'Order processed successfully!' });
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing the order.' });
    }
});


// 주문 내역 보기
router.get('/history', isStoreAccount, async (req, res) => {
    try {
        // 주문 목록 조회
        const orders = await Order.find({ userId: req.user._id })
            .populate('userId')  // 사용자 정보 포함
            .sort({ createdAt: -1 });

        // 콘솔로 orders 확인 (디버깅용)
        console.log(orders);

        res.render('orderHistory', { orders });
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).send('Error loading order history');
    }
});


// 주문 상세 정보 보기
router.get('/detail/:orderId', isStoreAccount, async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // 주문 ID로 주문 조회, 사용자 정보도 함께 가져옴
        const order = await Order.findById(orderId)
            .populate('userId')
            .populate('products.productId');  // 제품 정보도 함께 가져오기

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // 'orderDetails' 뷰를 렌더링, 포맷된 주문 번호를 포함하여 전달
        res.render('orderDetails', { order });
    } catch (error) {
        console.error('Error fetching order detail:', error);
        res.status(500).send('Error loading order detail');
    }
});

module.exports = router;
