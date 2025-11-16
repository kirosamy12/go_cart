import productsModel from '../../../DB/models/products.model.js';
import storeModel from '../../../DB/models/store.model.js';
import { nanoid } from 'nanoid';
import categoryModel from '../../../DB/models/category.model.js';


// ✅ CREATE PRODUCT (مع دعم الألوان والمقاسات والكميات)
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      mrp,
      price,
      images,
      colors, // ← الألوان اختيارية
      sizes,  // ← المقاسات اختيارية
      sizeQuantities, // ← الكميات لكل مقاس
      colorSizeQuantities, // ← الكميات لكل لون ومقاس
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

    // Process size quantities
    const processedSizeQuantities = new Map();
    if (sizeQuantities && typeof sizeQuantities === 'object') {
      Object.keys(sizeQuantities).forEach(size => {
        if (typeof sizeQuantities[size] === 'number' && sizeQuantities[size] >= 0) {
          processedSizeQuantities.set(size, sizeQuantities[size]);
        }
      });
    }

    // Process color size quantities
    const processedColorSizeQuantities = new Map();
    if (colorSizeQuantities && typeof colorSizeQuantities === 'object') {
      Object.keys(colorSizeQuantities).forEach(color => {
        if (typeof colorSizeQuantities[color] === 'object' && colorSizeQuantities[color] !== null) {
          const sizeMap = new Map();
          Object.keys(colorSizeQuantities[color]).forEach(size => {
            if (typeof colorSizeQuantities[color][size] === 'number' && colorSizeQuantities[color][size] >= 0) {
              sizeMap.set(size, colorSizeQuantities[color][size]);
            }
          });
          if (sizeMap.size > 0) {
            processedColorSizeQuantities.set(color, sizeMap);
          }
        }
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
      sizes: sizes || [],   // ← إذا مفيش مقاسات يبقى array فاضي
      sizeQuantities: processedSizeQuantities, // ← الكميات لكل مقاس
      colorSizeQuantities: processedColorSizeQuantities, // ← الكميات لكل لون ومقاس
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


// ✅ UPDATE PRODUCT (مع دعم تعديل الألوان والمقاسات والكميات)
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
      'sizeQuantities',
      'colorSizeQuantities',
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
          // لو مش JSON، حاول split بالـ comma
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
          // لو مش JSON، حاول split بالـ comma
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

    // Process size quantities
    if (updates.sizeQuantities) {
      if (typeof updates.sizeQuantities === 'string') {
        try {
          updates.sizeQuantities = JSON.parse(updates.sizeQuantities);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Size quantities must be a valid JSON object'
          });
        }
      }
      
      if (typeof updates.sizeQuantities === 'object' && !Array.isArray(updates.sizeQuantities)) {
        const processedSizeQuantities = new Map();
        Object.keys(updates.sizeQuantities).forEach(size => {
          if (typeof updates.sizeQuantities[size] === 'number' && updates.sizeQuantities[size] >= 0) {
            processedSizeQuantities.set(size, updates.sizeQuantities[size]);
          }
        });
        updates.sizeQuantities = processedSizeQuantities;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Size quantities must be an object with size as key and quantity as value'
        });
      }
    }

    // Process color size quantities
    if (updates.colorSizeQuantities) {
      if (typeof updates.colorSizeQuantities === 'string') {
        try {
          updates.colorSizeQuantities = JSON.parse(updates.colorSizeQuantities);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Color size quantities must be a valid JSON object'
          });
        }
      }
      
      if (typeof updates.colorSizeQuantities === 'object' && !Array.isArray(updates.colorSizeQuantities)) {
        const processedColorSizeQuantities = new Map();
        Object.keys(updates.colorSizeQuantities).forEach(color => {
          if (typeof updates.colorSizeQuantities[color] === 'object' && updates.colorSizeQuantities[color] !== null) {
            const sizeMap = new Map();
            Object.keys(updates.colorSizeQuantities[color]).forEach(size => {
              if (typeof updates.colorSizeQuantities[color][size] === 'number' && updates.colorSizeQuantities[color][size] >= 0) {
                sizeMap.set(size, updates.colorSizeQuantities[color][size]);
              }
            });
            if (sizeMap.size > 0) {
              processedColorSizeQuantities.set(color, sizeMap);
            }
          }
        });
        updates.colorSizeQuantities = processedColorSizeQuantities;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Color size quantities must be an object'
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


// ✅ GET ALL PRODUCTS (مع الألوان والكميات)
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

    // Format products to include quantity information
    const formattedProducts = products.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      
      // Format size quantities
      if (productObj.sizeQuantities) {
        productObj.sizeQuantities = Object.fromEntries(productObj.sizeQuantities);
      }
      
      // Format color size quantities
      if (productObj.colorSizeQuantities) {
        const formattedColorSize = {};
        for (const [color, sizesMap] of productObj.colorSizeQuantities) {
          formattedColorSize[color] = Object.fromEntries(sizesMap);
        }
        productObj.colorSizeQuantities = formattedColorSize;
      }
      
      return productObj;
    });

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      count: formattedProducts.length,
      products: formattedProducts || []
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


// ✅ GET PRODUCTS BY CATEGORY (مع الألوان والكميات)
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

    // Format products to include quantity information
    const formattedProducts = products.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      
      // Format size quantities
      if (productObj.sizeQuantities) {
        productObj.sizeQuantities = Object.fromEntries(productObj.sizeQuantities);
      }
      
      // Format color size quantities
      if (productObj.colorSizeQuantities) {
        const formattedColorSize = {};
        for (const [color, sizesMap] of productObj.colorSizeQuantities) {
          formattedColorSize[color] = Object.fromEntries(sizesMap);
        }
        productObj.colorSizeQuantities = formattedColorSize;
      }
      
      return productObj;
    });

    res.status(200).json({
      success: true,
      message: 'Products in the same category fetched successfully',
      count: formattedProducts.length,
      products: formattedProducts || [],
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


// ✅ GET SINGLE PRODUCT (مع الألوان والكميات)
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productsModel.findOne({ id })
      .populate('storeId', 'name email image')
      .populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Format product to include quantity information
    const productObj = product.toObject ? product.toObject() : product;
    
    // Format size quantities
    if (productObj.sizeQuantities) {
      productObj.sizeQuantities = Object.fromEntries(productObj.sizeQuantities);
    }
    
    // Format color size quantities
    if (productObj.colorSizeQuantities) {
      const formattedColorSize = {};
      for (const [color, sizesMap] of productObj.colorSizeQuantities) {
        formattedColorSize[color] = Object.fromEntries(sizesMap);
      }
      productObj.colorSizeQuantities = formattedColorSize;
    }

    res.status(200).json({ success: true, product: productObj });
  } catch (err) {
    console.error('Get Product Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ GET PRODUCTS BY STORE USERNAME (مع الألوان والكميات)
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

    // Format products to include quantity information
    const formattedProducts = products.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      
      // Format size quantities
      if (productObj.sizeQuantities) {
        productObj.sizeQuantities = Object.fromEntries(productObj.sizeQuantities);
      }
      
      // Format color size quantities
      if (productObj.colorSizeQuantities) {
        const formattedColorSize = {};
        for (const [color, sizesMap] of productObj.colorSizeQuantities) {
          formattedColorSize[color] = Object.fromEntries(sizesMap);
        }
        productObj.colorSizeQuantities = formattedColorSize;
      }
      
      return productObj;
    });

    res.status(200).json({ success: true, products: formattedProducts });
  } catch (err) {
    console.error('Get Store Products Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// ✅ GET MY STORE PRODUCTS (مع الألوان والكميات)
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

    // Format products to include quantity information
    const formattedProducts = products.map(product => {
      // Format size quantities
      if (product.sizeQuantities) {
        product.sizeQuantities = Object.fromEntries(product.sizeQuantities);
      }
      
      // Format color size quantities
      if (product.colorSizeQuantities) {
        const formattedColorSize = {};
        for (const [color, sizesMap] of product.colorSizeQuantities) {
          formattedColorSize[color] = Object.fromEntries(sizesMap);
        }
        product.colorSizeQuantities = formattedColorSize;
      }
      
      return product;
    });

    res.status(200).json({
      success: true,
      message: 'Products for your store fetched successfully',
      count: formattedProducts.length,
      products: formattedProducts,
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
