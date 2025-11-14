import mongoose from 'mongoose';

const embeddedOrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  selectedColor: {
    type: String,
    default: null  // ← إضافة هذا الحقل
  },
  selectedSize: {
    type: String,
    default: null  // ← إضافة هذا الحقل للحجم
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ["ORDER_PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "PENDING", "READY", "PICKED_UP", "CANCELLED"],
    default: "ORDER_PLACED"
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    enum: ["CASH", "VISA"],
    required: true
  },
  isCouponUsed: {
    type: Boolean,
    default: false
  },
  coupon: {
    type: Object,
    default: {}
  },
  orderItems: [embeddedOrderItemSchema]
}, {
  timestamps: true
});

export default mongoose.model('Order', orderSchema);