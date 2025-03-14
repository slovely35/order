require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');


// 회원가입
async function register(req, res) {
  try {
    const { storeName, address, email, confirmEmail, password, confirmPassword } = req.body;

    // 입력 값 유효성 검사
    if (!storeName || !address || !address.town || !address.state || !address.zipcode || !email || !confirmEmail || !password || !confirmPassword) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/auth/register');
    }

    // 이메일 일치 여부 확인
    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
      req.flash('error', 'Emails do not match.');
      return res.redirect('/auth/register');
    }

    // 비밀번호 일치 여부 확인
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/auth/register');
    }

    // 이메일 형식 확인
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Invalid email format.');
      return res.redirect('/auth/register');
    }

    // 비밀번호 최소 길이 확인
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect('/auth/register');
    }

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      req.flash('error', 'Email already in use. Please use a different email.');
      return res.redirect('/auth/register');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새 사용자 생성
    const user = new User({
      storeName,
      address: {
        town: address.town,
        state: address.state,
        zipcode: address.zipcode,
      },
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'storeOwner', // 기본 역할 설정
    });

    await user.save();

    req.flash('success_msg', 'Registration successful. You can now log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Error registering user:', err);
    req.flash('error', 'An error occurred during registration. Please try again later.');
    res.redirect('/auth/register');
  }
}



// 로그인
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt - Email:', email);
    console.log('Admin Email:', adminEmail);
    console.log('Admin Password:', adminPassword);

    // 관리자 계정 인증
    if (email.toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
      console.log('Admin credentials matched.');
      const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '2h' }
      );

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: false,
        maxAge: 2 * 60 * 60 * 1000,
      });

      console.log('Redirecting to /admin/dashboard');
      return res.redirect('/admin/dashboard');
    }

    // 일반 사용자 인증
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('Invalid credentials:', email);
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '2h' }
    );

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: false,
      maxAge: 2 * 60 * 60 * 1000,
    });

    if (user.role === 'storeOwner') {
      console.log('Store owner logged in. Redirecting to /store/dashboard');
      return res.redirect('/store/dashboard');
    } else {
      console.log('Unknown role. Access denied.');
      return res.status(403).send('Access denied.');
    }
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).send('An error occurred during login.');
  }
};

module.exports = { register, login };
