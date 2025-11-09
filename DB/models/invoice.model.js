import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  lineTotal: {
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
  availableColors: {
    type: [String],
    default: []
  },
  availableSizes: {
    type: [String],
    default: []
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
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
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  billingAddress: {
    type: Object,
    required: true
  },
  sellerInfo: {
    type: Object,
    required: true
  },
  buyerInfo: {
    type: Object,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["CASH", "VISA"],
    required: true
  },
  orderStatus: {
    type: String,
    enum: ["ORDER_PLACED", "PROCESSING", "SHIPPED", "DELIVERED"],
    default: "DELIVERED"
  },
  orderCreatedAt: {
    type: Date,
    required: true
  },
  orderDeliveredAt: {
    type: Date,
    default: Date.now
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid', 'overdue'],
    default: 'paid'
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ userId: 1 });
invoiceSchema.index({ storeId: 1 });
invoiceSchema.index({ issuedAt: -1 });

// Pre-save middleware to generate invoice number if not provided
invoiceSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    // Generate a more professional invoice number format: INV-YYYYMMDD-XXXX
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Simple approach - use timestamp as fallback
    const timestamp = Date.now().toString().slice(-4).padStart(4, '0');
    this.invoiceNumber = `INV-${dateStr}-${timestamp}`;
    console.log('Generated invoice number:', this.invoiceNumber);
  }
  next();
});

const invoiceModel = mongoose.model("Invoice", invoiceSchema);
export default invoiceModel;