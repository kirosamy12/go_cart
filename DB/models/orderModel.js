import mongoose from 'mongoose';

// ✅ Schema للـ items داخل كل store
const storeItemSchema = new mongoose.Schema({
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
    default: null
  },
  selectedSize: {
    type: String,
    default: null
  },
  selectedScent: {
    type: String,
    default: null
  }
}, { _id: false });

// ✅ Schema لبيانات كل store في الـ order
const orderStoreSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  items: [storeItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

// ✅ Schema للـ order items (للتوافق مع الكود القديم)
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
    default: null
  },
  selectedSize: {
    type: String,
    default: null
  },
  selectedScent: {
    type: String,
    default: null
  }
}, { _id: false });

// ✅ Order Schema الرئيسي
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
  subtotal: {
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
  // ✅ storeId القديم (optional للتوافق)
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: false
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
    code: String,
    discountPercentage: Number,
    discountAmount: Number
  },
  // ✅ orderItems القديم (للتوافق)
  orderItems: [embeddedOrderItemSchema],
  
  // ✅ الحقل الجديد - تفاصيل كل store
  stores: {
    type: [orderStoreSchema],
    default: []
  }
}, {
  timestamps: true
});

// ✅ Index للبحث السريع
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'stores.storeId': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ id: 1 });

export default mongoose.model('Order', orderSchema);