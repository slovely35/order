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

        // 선택된 제품이 없을 경우 처리
        if (!selectedProducts || selectedProducts.length === 0) {
            console.error('No products selected for checkout');
            return res.status(400).json({ success: false, message: 'No products selected for checkout' });
        }

        // 선택된 제품 조회
        const products = await Product.find({ _id: { $in: selectedProducts } });
        if (!products || products.length === 0) {
            console.error('No valid products found for the given IDs');
            return res.status(400).json({ success: false, message: 'Invalid products selected' });
        }

        let totalAmount = 0;
        const insufficientStockProducts = [];
        const orderItems = await Promise.all(
            products.map(async (product) => {
                const quantity = parseInt(quantities[product._id], 10);

                // 수량 검증 (재고 초과 또는 0 이하)
                if (!quantity || quantity <= 0 || quantity > product.stock) {
                    insufficientStockProducts.push(product.name);
                    return null;
                }

                const subtotal = product.price * quantity;
                totalAmount += subtotal;

                // 재고 업데이트
                product.stock -= quantity;
                await product.save();

                return {
                    productId: product._id,
                    name: product.name,
                    price: product.price,
                    quantity,
                    subtotal,
                };
            })
        );

        if (insufficientStockProducts.length > 0) {
            console.error(`Insufficient stock for products: ${insufficientStockProducts.join(', ')}`);
            return res.status(400).json({
                success: false,
                message: `Out of stock. Contact your manager`,
            });
        }

        const validOrderItems = orderItems.filter((item) => item !== null);
        const orderNumber = await generateOrderNumber();

        // 주문 생성
        const order = new Order({
            orderNumber,
            userId: req.user._id,
            products: validOrderItems,
            totalAmount,
        });
        await order.save();

        // 장바구니 비우기
        await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });

        // 주문 날짜 추가
        const orderDate = new Date();
        const user = await User.findById(req.user._id);

        // 이메일 내용 준비
        const orderDateFormatted = new Date(orderDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const emailContent = `
            <h2 style="font-size: 18px;">New Order Received</h2>
            <p><strong style="font-size: 20px; font-weight: bold;">Store Name: ${user.storeName}</strong></p>
            <p><strong style="font-size: 16px;">Address:</strong> ${user.address.town}, ${user.address.state}, ${user.address.zipcode}</p>
            <p><strong style="font-size: 16px;">Order Date:</strong> ${orderDateFormatted}</p>
            <h3 style="font-size: 16px;">Order Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${validOrderItems
                        .map(
                            (item) =>
                                `<tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">$${item.subtotal.toFixed(2)}</td>
                                </tr>`
                        )
                        .join('')}
                </tbody>
            </table>
            <p><strong style="font-size: 16px;">Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
        `;

        // PDF 파일 생성
        const pdfFilePath = path.join(__dirname, 'order.pdf');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(emailContent);
        await page.pdf({ path: pdfFilePath, format: 'A4' });
        await browser.close();

        // 이메일 전송
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: `"Order System" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `New Order from ${user.storeName}`,
            text: 'Please find the attached PDF for the order details.',
            attachments: [
                {
                    filename: 'order.pdf',
                    path: pdfFilePath,
                },
            ],
        });

        console.log('Order processed and email with PDF sent successfully');

        // PDF 파일 삭제
        fs.unlinkSync(pdfFilePath);

        res.status(200).json({ success: true, message: 'Order processed successfully!' });
    } catch (error) {
        console.error('Error processing order:', error.message);

        if (error.message.startsWith('Insufficient stock')) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the order.',
        });
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
