const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// 로그인 페이지 라우트
router.get('/login', (req, res) => {
  res.render('login');
});

// 로그인 처리 라우트
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('error', info.message || 'Invalid email or password.');
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }

      // 역할에 따른 리다이렉트
      const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/store/dashboard';
      return res.redirect(redirectUrl);
    });
  })(req, res, next);
});

// 로그아웃 라우트
router.get('/logout', (req, res) => {
  res.clearCookie('authToken'); // 인증 토큰 쿠키 제거
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login'); // 로그인 페이지로 리다이렉트
  });
});

// 회원가입 페이지 라우트
router.get('/register', (req, res) => {
  res.render('register');
});

// 회원가입 처리 라우트
router.post('/register', authController.register); // 회원가입 로직은 authController에서 처리

module.exports = router;
