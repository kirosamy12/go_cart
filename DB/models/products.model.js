// models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  mrp: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', // 👈 تأكد إنك عندك موديل اسمه Category
    required: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store', // 👈 تأكد إنك عندك موديل اسمه Store
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Product', productSchema);
