// addAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // User 모델 경로 확인
require('dotenv').config();

async function createAdmin() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true, // 최신 Mongoose에서는 옵션이 기본값이지만, 명시적으로 추가
      useUnifiedTopology: true, // 최신 드라이버에서도 옵션 추가
    });
    console.log('Connected to MongoDB');

    // 관리자 계정 정보 설정
    const adminData = {
      storeName: 'Admin Store',
      address: {
        town: 'Admin Town',
        state: 'Admin State',
        zipcode: '00000',
      },
      email: 'inquiry@101chicken.com',
      password: await bcrypt.hash('2251lemoine', 10), // 비밀번호 해시 처리
      role: 'admin',
    };

    // 이미 관리자 계정이 있는지 확인
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('Admin account already exists. No changes made.');
    } else {
      // 관리자 계정 생성
      const admin = new User(adminData);
      await admin.save();
      console.log('Admin account created successfully');
    }

    // MongoDB 연결 닫기
    mongoose.connection.close();
  } catch (error) {
    console.error('Error creating admin account:', error);
    mongoose.connection.close(); // 오류 발생 시에도 연결 닫기
  }
}

// 스크립트 실행
createAdmin();
