const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true,
});

transporter.sendMail({
    from: `"Test" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: 'Test Email',
    text: 'This is a test email.',
}, (err, info) => {
    if (err) {
        console.error('Error sending email:', err.message);
    } else {
        console.log('Email sent:', info.response);
    }
});
