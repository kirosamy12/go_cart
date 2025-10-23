import productsModel from '../../../DB/models/products.model.js';
import storeModel from '../../../DB/models/store.model.js';
import { nanoid } from 'nanoid';
import categoryModel from '../../../DB/models/category.model.js';


// ✅ CREATE PRODUCT (مع دعم الألوان)
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      mrp,
      price,
      images,
      colors, // ← الألوان اختيارية
      category,
      inStock
    } = req.body;

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

    const product = new productsModel({
      id: nanoid(10),
      name,
      description,
      mrp,
      price,
      images,
      colors: colors || [], // ← إذا مفيش ألوان يبقى array فاضي
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


// ✅ GET ALL PRODUCTS (مع الألوان)
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


// ✅ GET PRODUCTS BY CATEGORY (مع الألوان)
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


// ✅ GET SINGLE PRODUCT (مع الألوان)
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


// ✅ GET PRODUCTS BY STORE USERNAME (مع الألوان)
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


// ✅ GET MY STORE PRODUCTS (مع الألوان)
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

    const products = await productsModel.find({ storeId: store._id })
      .populate('storeId', 'name email image username')
      .populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Products for your store fetched successfully',
      count: products.length,
      products
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


// ✅ UPDATE PRODUCT (مع دعم تعديل الألوان)
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
      'colors', // ← إضافة الألوان للحقول المسموحة
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

    // استبدل الصور القديمة بالصور المرفوعة من كلاودنيري
    if (uploadedImages.length > 0) {
      updates.images = uploadedImages;
    }

    // لو عايز تحديث الألوان، اتأكد إنها array
    if (updates.colors && !Array.isArray(updates.colors)) {
      return res.status(400).json({
        success: false,
        message: 'Colors must be an array'
      });
    }

    if (
      updates.price &&
      updates.mrp &&
      Number(updates.price) > Number(updates.mrp)
    ) {
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
      message: 'Internal Server Error'
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