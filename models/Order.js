const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const orderSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    products: [
      {
        productId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Product', 
          required: true 
        },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        subtotal: { type: Number, required: true },
      },
    ],
    totalAmount: { 
      type: Number, 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], 
      default: 'Pending' 
    },
    orderNumber: { 
      type: Number, // 자동 증가가 적용될 필드
      unique: true,
      required: true
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 추가
  }
);

// AutoIncrement 설정
orderSchema.plugin(AutoIncrement, { inc_field: 'orderNumber' });

// 주문 번호 포맷팅을 위한 virtual 필드 추가
orderSchema.virtual('formattedOrderNumber').get(function () {
  if (this.orderNumber) {
    return `ORD-${this.orderNumber.toString().padStart(5, '0')}`; // 예시: 'ORD-00001'
  }
  return 'ORD-00000'; // orderNumber가 없을 경우 기본값
});

// virtual을 적용했을 때 .toObject() 또는 .toJSON() 메소드 호출 시 virtual이 포함되도록 설정
orderSchema.set('toObject', { virtuals: true });
orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
