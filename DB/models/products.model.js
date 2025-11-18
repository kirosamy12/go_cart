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
  // New field for scent/smell
  scents: {
    type: [String],     // 👈 مصفوفة روائح مثل ['Rose', 'Lavender', 'Vanilla']
    default: []         // 👈 مش إلزامي
  },
  // New field for quantity per size
  sizeQuantities: {
    type: Map,
    of: Number,
    default: {}
  },
  // New field for quantity per color and size combination
  colorSizeQuantities: {
    type: Map,
    of: Map,
    default: {}
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

// Custom toJSON method to ensure arrays are properly serialized
productSchema.methods.toJSON = function() {
  const product = this.toObject();
  
  // Ensure colors, sizes, and scents are proper arrays
  // If they are strings that look like arrays, parse them
  if (product.colors && typeof product.colors === 'string') {
    try {
      product.colors = JSON.parse(product.colors);
    } catch (e) {
      // If JSON.parse fails, split by comma and clean up
      product.colors = product.colors.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  if (product.sizes && typeof product.sizes === 'string') {
    try {
      product.sizes = JSON.parse(product.sizes);
    } catch (e) {
      // If JSON.parse fails, split by comma and clean up
      product.sizes = product.sizes.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  if (product.scents && typeof product.scents === 'string') {
    try {
      product.scents = JSON.parse(product.scents);
    } catch (e) {
      // If JSON.parse fails, split by comma and clean up
      product.scents = product.scents.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  // Ensure they are arrays, if not already
  if (!Array.isArray(product.colors)) {
    product.colors = [];
  }
  
  if (!Array.isArray(product.sizes)) {
    product.sizes = [];
  }
  
  if (!Array.isArray(product.scents)) {
    product.scents = [];
  }
  
  return product;
};

export default mongoose.model('Product', productSchema);