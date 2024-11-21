const jwt = require('jsonwebtoken');

function isAuthenticated(req, res, next) {
  const token = req.cookies.authToken;
  if (!token) {
    console.log('No token found');
    return res.redirect('/auth/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    console.log('Decoded token:', decoded); // 디버깅 로그
    req.user = decoded; // 디코딩된 정보를 req.user에 저장
    next();
  } catch (error) {
    console.error('Invalid token:', error.message);
    res.redirect('/auth/login');
  }
}

function isAdmin(req, res, next) {
  console.log('Checking admin access:', req.user); // 디버깅 로그
  if (req.user && req.user.role === 'admin') {
    console.log('Admin access granted:', req.user.email);
    return next();
  }
  console.log('Access denied: Not an admin');
  res.status(403).send('Access Denied');
}

function isStoreAccount(req, res, next) {
  console.log('Checking store account:', req.user); // 로그인된 사용자 정보 출력
  if (req.user && req.user.role === 'storeOwner') {
    console.log('Store access granted:', req.user.email);
    return next();
  } else {
    console.log('Access denied for non-store owners');
    return res.redirect('/auth/login');
  }
}


module.exports = { isAuthenticated, isAdmin, isStoreAccount };
