const bcrypt = require('bcryptjs');

// 데이터베이스에서 가져온 해시된 비밀번호
const hashedPassword = '$2a$10$9govEEILIISSuHTvEh7L0u7LqpCrwJgNGsQ.ixzOWDZNWO9ak5cVq'; // 예시
// 사용자가 입력한 비밀번호
const inputPassword = '1234'; // 테스트할 비밀번호

// 비밀번호 비교
bcrypt.compare(inputPassword, hashedPassword, (err, isMatch) => {
  if (err) {
    console.error('Error comparing passwords:', err);
  } else {
    if (isMatch) {
      console.log('✅ Passwords match: The input password is correct.');
    } else {
      console.log('❌ Passwords do not match: The input password is incorrect.');
    }
  }
});
