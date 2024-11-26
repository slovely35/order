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

// 주문 번호 형식 지정 함수 (기존 방식 그대로 유지)
function formatOrderNumber(orderNumber) {
    if (!orderNumber) {
        console.error('Invalid order number:', orderNumber); // Log if orderNumber is undefined or invalid
        return ''; // Return an empty string or handle the error case appropriately
    }

    return `ORD-${orderNumber.toString().padStart(5, '0')}`; // 포맷 적용 예시: 'ORD-00001'
}

// 주문 번호 자동 생성 함수
async function generateOrderNumber() {
    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    const lastOrderNumber = lastOrder ? lastOrder.orderNumber : 0;
    return lastOrderNumber + 1;  // 새로운 주문 번호 생성
}

// 주문 생성
router.post('/checkout', isStoreAccount, async (req, res) => {
    try {
        const { selectedProducts, quantities } = req.body;

        if (!selectedProducts || selectedProducts.length === 0) {
            console.error('No products selected for checkout');
            return res.status(400).send('No products selected for checkout');
        }

        const products = await Product.find({ _id: { $in: selectedProducts } });
        if (!products || products.length === 0) {
            console.error('No valid products found for the given IDs');
            return res.status(400).send('Invalid products selected');
        }

        let totalAmount = 0;
        const orderItems = await Promise.all(
            products.map(async (product) => {
                const quantity = parseInt(quantities[product._id], 10);
                if (!quantity || quantity <= 0 || quantity > product.stock) {
                    throw new Error(`Invalid quantity for product ${product.name}`);
                }

                const subtotal = product.price * quantity;
                totalAmount += subtotal;

                // Update product stock
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

        // 주문 번호 자동 생성
        const orderNumber = await generateOrderNumber();

        // 주문 생성
        const order = new Order({
            orderNumber,  // 주문 번호 추가
            userId: req.user._id,
            products: orderItems,
            totalAmount,
            status: 'Pending',
        });
        await order.save();

        // 장바구니 비우기
        await Cart.updateOne(
            { userId: req.user._id },
            { $set: { items: [] } }  // 장바구니의 모든 항목을 비움
        );
        

        // 주문 날짜 추가
        const orderDate = new Date().toLocaleString();

        // 사용자 정보 가져오기
        const user = await User.findById(req.user._id);

        // orderDate를 영어 형식으로 변환
        const orderDateFormatted = new Date(orderDate).toLocaleDateString('en-US', {
            weekday: 'long', // 요일
            year: 'numeric',
            month: 'long',   // 월
            day: 'numeric'   // 일
        });
  
    // HTML 템플릿
    const emailContent = `
        <h2 style="font-size: 18px;">New Order Received</h2>
        <p><strong style="font-size: 20px; font-weight:bold;">Store Name: ${user.storeName}</strong></p>
        <p><strong style="font-size: 20px;">Store:</strong> ${user.storeName}</p>
        <p><strong style="font-size: 16px;">Address:</strong> ${user.address}</p>
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
                ${orderItems
                    .map(
                        (item) =>
                            `<tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">₩${item.subtotal.toLocaleString()}</td>
                            </tr>`
                    )
                    .join('')}
            </tbody>
        </table>
        <p><strong style="font-size: 16px;">Total Amount:</strong> ₩${totalAmount.toLocaleString()}</p>
        <div style="margin-top: 20px;">
            <h3 style="font-size: 16px;">Order Fulfillment</h3>
            <p style="font-size: 16px;">Date: __________________________________</p>
            <p style="font-size: 16px;">Signature: _______________________________</p>
        </div>
    `;
  

        // PDF 파일 경로 설정
        const pdfFilePath = path.join(__dirname, 'order.pdf');

        // Puppeteer를 사용하여 HTML을 PDF로 변환
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(emailContent);
        await page.pdf({ path: pdfFilePath, format: 'A4' });
        await browser.close();

        // 이메일 전송
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

        // 완료 후 PDF 파일 삭제 (선택 사항)
        fs.unlinkSync(pdfFilePath);

        // 주문 확인 페이지로 이동
        res.render('order', { order });
    } catch (error) {
        console.error('Error processing order:', error.message);
        res.status(500).send('Error processing order');
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
