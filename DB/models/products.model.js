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
  colors: {
    type: [String],     // 👈 مصفوفة ألوان مثل ['Red', 'Blue', 'Black']
    default: []         // 👈 مش إلزامي، فلو المستخدم ما أرسلش ألوان بتبقى فاضية
  },
  sizes: {
    type: [String],     // 👈 مصفوفة مقاسات مثل ['S', 'M', 'L', 'XL']
    default: []         // 👈 مش إلزامي، فلو المستخدم ما أرسلش مقاسات بتبقى فاضية
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Product', productSchema);