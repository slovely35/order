require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const connectFlash = require('connect-flash');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const Cart = require('./models/Cart');

const adminRoutes = require('./routes/adminRoutes');
const storeRoutes = require('./routes/storeRoutes');
const orderRoutes = require('./routes/orderRoutes');


const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// MongoDB URI 환경 변수에서 가져오기
const uri = process.env.MONGO_URI;


// MongoDB URI가 없을 경우 오류 메시지 출력
if (!uri) {
  console.error('MongoDB URI가 환경 변수에서 정의되지 않았습니다.');
  process.exit(1);  // 종료 코드 1로 프로세스 종료
}

// MongoDB 연결
mongoose.connect(uri)
.then(() => console.log('MongoDB 연결 성공'))
.catch((err) => console.error('MongoDB 연결 오류:', err));


// MongoDB 연결
connectDB();

// 세션 미들웨어 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true,
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.successMessage = req.flash('successMessage');
  res.locals.errorMessage = req.flash('errorMessage');
  next();
});

// 전역 `title` 기본값 설정
app.use((req, res, next) => {
  res.locals.title = 'Default Title'; // 기본 title 값
  next();
});

// 플래시 메시지 미들웨어
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 바디 파서 및 기타 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/storeLayout');

// Passport 로컬 전략 설정
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// 사용자 직렬화 및 역직렬화 설정
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// 라우트 설정
app.use('/auth', require('./routes/authRoutes'));
app.use('/products', require('./routes/productRoutes'));
app.use('/cart', require('./routes/cartRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes); // 관리자 라우트
app.use('/store', storeRoutes); // 가맹점 소유자 라우트


// 관리자가 가맹점 전용 라우트에 접근할 경우 리디렉션
app.use('/store', (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    console.log('Admin attempted to access store route. Redirecting to /admin/dashboard');
    return res.redirect('/admin/dashboard');
  }
  next();
});

// 루트 경로에서 login.ejs 렌더링
app.get('/', (req, res) => {
  res.redirect('/auth/login'); // 루트에서 로그인 페이지로 리디렉션
});

// 로그인 라우트
app.post('/auth/login', (req, res, next) => {
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

      // 역할에 따라 동적으로 리디렉션
      const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/store/dashboard';
      return res.redirect(redirectUrl);
    });
  })(req, res, next);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
