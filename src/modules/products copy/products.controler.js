import productsModel from '../../../DB/models/products.model.js';
import storeModel from '../../../DB/models/store.model.js';
import { nanoid } from 'nanoid';
import categoryModel from '../../../DB/models/category.model.js';


// ✅ CREATE PRODUCT (مع دعم الألوان والروائح والكميات)
export const createProduct = async (req, res) => {
  try {
    let {
      name,
      description,
      mrp,
      price,
      images,
      colors,          // ← الألوان اختيارية
      sizes,           // ← المقاسات اختيارية
      scents,          // ← الروائح اختيارية
      sizeQuantities,  // ← الكميات لكل مقاس اختيارية
      category,
      inStock
    } = req.body;

    // ✅ معالجة colors - تحويلها من string لـ array
    if (colors) {
      if (typeof colors === 'string') {
        try {
          colors = JSON.parse(colors);
        } catch (e) {
          colors = colors.split(',').map(c => c.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(colors)) {
        colors = [];
      }
    }

    // ✅ معالجة sizes - تحويلها من string لـ array
    if (sizes) {
      if (typeof sizes === 'string') {
        try {
          sizes = JSON.parse(sizes);
        } catch (e) {
          sizes = sizes.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(sizes)) {
        sizes = [];
      }
    }

    // ✅ معالجة scents - تحويلها من string لـ array
    if (scents) {
      if (typeof scents === 'string') {
        try {
          scents = JSON.parse(scents);
        } catch (e) {
          scents = scents.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(scents)) {
        scents = [];
      }
    }

    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not found in request'
      });
    }

    if (!name || !mrp || !price || !category || !images?.length) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided.'
      });
    }

    if (price > mrp) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be greater than MRP.'
      });
    }

    const store = await storeModel.findOne({ userId });

    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Store not found'
      });
    }

    // ✅ معالجة sizeQuantities إذا كان string أو object
    let processedSizeQuantities = {};
    if (sizeQuantities) {
      if (typeof sizeQuantities === 'string') {
        try {
          processedSizeQuantities = JSON.parse(sizeQuantities);
        } catch (e) {
          console.error('Invalid sizeQuantities format:', e);
        }
      } else if (typeof sizeQuantities === 'object') {
        processedSizeQuantities = sizeQuantities;
      }
    }

    const product = new productsModel({
      id: nanoid(10),
      name,
      description,
      mrp,
      price,
      images,
      colors: colors || [],
      sizes: sizes || [],
      scents: scents || [],              // ← إضافة الروائح
      sizeQuantities: processedSizeQuantities, // ← إضافة الكميات
      category,
      inStock: inStock !== undefined ? inStock : true,
      storeId: store._id
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (err) {
    console.error('Create Product Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ GET ALL PRODUCTS (مع الألوان والروائح والكميات)
export const getAllProducts = async (req, res) => {
  try {
    const products = await productsModel.find()
      .populate({
        path: 'storeId',
        select: 'name email image'
      })
      .populate({
        path: 'category',
        select: 'name slug'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      count: products.length,
      products: products || []
    });
  } catch (err) {
    console.error('Get Products Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};


// ✅ GET PRODUCTS BY CATEGORY (مع الألوان والروائح والكميات)
export const getProductsByCategory = async (req, res) => {
  const { slug } = req.params;

  try {
    const category = await categoryModel.findOne({ slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const products = await productsModel.find({ category: category._id })
      .populate({
        path: 'storeId',
        select: 'name email image',
      })
      .populate({
        path: 'category',
        select: 'name slug',
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Products in the same category fetched successfully',
      count: products.length,
      products: products || [],
    });
  } catch (err) {
    console.error('Get Products by Category Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message,
    });
  }
};


// ✅ GET SINGLE PRODUCT (مع الألوان والروائح والكميات)
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productsModel.findOne({ id })
      .populate('storeId', 'name email image')
      .populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (err) {
    console.error('Get Product Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ GET PRODUCTS BY STORE USERNAME (مع الألوان والروائح والكميات)
export const getProductsByStoreUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const store = await storeModel.findOne({ username });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const products = await productsModel.find({ storeId: store._id })
      .populate('storeId', 'name email image username')
      .populate('category', 'name slug');

    res.status(200).json({ success: true, products });
  } catch (err) {
    console.error('Get Store Products Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ GET MY STORE PRODUCTS (مع الألوان والروائح والكميات)
export const getMyStoreProducts = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not found in token'
      });
    }

    const store = await storeModel.findOne({ userId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found for this user'
      });
    }

    // Get query parameters for pagination and filtering
    const { page = 1, limit = 10, category, inStock } = req.query;
    const skip = (page - 1) * limit;

    // Build query filter
    const query = { storeId: store._id };
    if (category) query.category = category;
    if (inStock !== undefined) query.inStock = inStock === 'true';

    // Get products with pagination
    const [products, total] = await Promise.all([
      productsModel.find(query)
        .populate('storeId', 'name email image username')
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      productsModel.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Products for your store fetched successfully',
      count: products.length,
      products,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get My Store Products Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};


// ✅ UPDATE PRODUCT (مع دعم تعديل الألوان والروائح والكميات)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const uploadedImages = req.body.images || [];

    const allowedFields = [
      'name',
      'description',
      'mrp',
      'price',
      'images',
      'colors',
      'sizes',
      'scents',          // ← إضافة scents
      'sizeQuantities',  // ← إضافة sizeQuantities
      'category',
      'inStock',
      'storeId'
    ];

    const updates = {};

    allowedFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    // ✅ تحويل الـ strings للـ arrays إذا لزم الأمر
    if (updates.colors) {
      if (typeof updates.colors === 'string') {
        try {
          updates.colors = JSON.parse(updates.colors);
        } catch (e) {
          updates.colors = updates.colors.split(',').map(c => c.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(updates.colors)) {
        return res.status(400).json({
          success: false,
          message: 'Colors must be an array'
        });
      }
    }

    if (updates.sizes) {
      if (typeof updates.sizes === 'string') {
        try {
          updates.sizes = JSON.parse(updates.sizes);
        } catch (e) {
          updates.sizes = updates.sizes.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(updates.sizes)) {
        return res.status(400).json({
          success: false,
          message: 'Sizes must be an array'
        });
      }
    }

    // ✅ معالجة scents
    if (updates.scents) {
      if (typeof updates.scents === 'string') {
        try {
          updates.scents = JSON.parse(updates.scents);
        } catch (e) {
          updates.scents = updates.scents.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(updates.scents)) {
        return res.status(400).json({
          success: false,
          message: 'Scents must be an array'
        });
      }
    }

    // ✅ معالجة sizeQuantities
    if (updates.sizeQuantities) {
      if (typeof updates.sizeQuantities === 'string') {
        try {
          updates.sizeQuantities = JSON.parse(updates.sizeQuantities);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid sizeQuantities format'
          });
        }
      }
      
      if (typeof updates.sizeQuantities !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'sizeQuantities must be an object'
        });
      }
    }

    // استبدل الصور القديمة بالصور المرفوعة
    if (uploadedImages.length > 0) {
      updates.images = uploadedImages;
    }

    if (updates.price && updates.mrp && Number(updates.price) > Number(updates.mrp)) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be greater than MRP.'
      });
    }

    if (updates.category) {
      const categoryExists = await categoryModel.findById(updates.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
    }

    const product = await productsModel.findOneAndUpdate({ id }, updates, {
      new: true,
      runValidators: true
    })
      .populate('storeId', 'name email')
      .populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });

  } catch (err) {
    console.error('Update Product Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};


// ✅ DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productsModel.findOneAndDelete({ id });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete Product Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ TOGGLE STOCK
export const toggleStock = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productsModel.findOne({ id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.inStock = !product.inStock;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product stock status toggled to ${product.inStock}`,
      product
    });
  } catch (err) {
    console.error('Toggle Stock Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};