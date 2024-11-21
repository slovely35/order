// controllers/cartController.js

// 장바구니에 물건 추가
function addToCart(req, res) {
    const { productId, quantity } = req.body;
  
    // 세션에 장바구니가 없으면 빈 배열로 초기화
    if (!req.session.cart) {
      req.session.cart = [];
    }
  
    // 장바구니에 동일한 상품이 있는지 확인
    const existingItem = req.session.cart.find(item => item.productId === productId);
  
    if (existingItem) {
      existingItem.quantity += parseInt(quantity, 10); // 수량을 추가
    } else {
      req.session.cart.push({ productId, quantity: parseInt(quantity, 10) });
    }
  
    res.redirect('/cart');
  }
  
  // 장바구니 내용 조회
  async function viewCart(req, res) {
    const cart = req.session.cart || [];
    const cartDetails = await Promise.all(cart.map(async (item) => {
      const product = await Product.findById(item.productId);
      return { ...product.toObject(), quantity: item.quantity };
    }));
  
    res.render('cart', { cart: cartDetails });
  }
  
  // 장바구니에서 물건 제거
  function removeFromCart(req, res) {
    const { productId } = req.body;
    req.session.cart = req.session.cart.filter(item => item.productId !== productId);
    res.redirect('/cart');
  }
  
  module.exports = { addToCart, viewCart, removeFromCart };
  