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
router.get('/logout', async (req, res, next) => {
  try {
    await req.logout(); // 최신 Passport에서 비동기로 처리
    req.flash('success_msg', 'You have logged out successfully.');
    res.redirect('/auth/login');
  } catch (error) {
    next(error);
  }
});

// 회원가입 페이지 라우트
router.get('/register', (req, res) => {
  res.render('register');
});

// 회원가입 처리 라우트
router.post('/register', authController.register); // 회원가입 로직은 authController에서 처리

module.exports = router;
