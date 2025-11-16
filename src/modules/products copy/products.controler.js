import { nanoid } from 'nanoid';
import productsModel from '../../../DB/models/products.model.js';
import storeModel from '../../../DB/models/store.model.js';
import categoryModel from '../../../DB/models/category.model.js';

// ✅ CREATE PRODUCT (مع دعم الألوان والمقاسات والكميات والروائح)
export const createProduct = async (req, res) => {
  try {
    let {
      name,
      description,
      mrp,
      price,
      images,
      colors, // ← الألوان اختيارية
      sizes,  // ← المقاسات اختيارية
      scents, // ← الروائح اختيارية
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

    // Parse MRP and price to numbers
    mrp = Number(mrp);
    price = Number(price);

    if (price > mrp) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be greater than MRP.'
      });
    }

    // ✅ تحويل الـ strings للـ arrays إذا لزم الأمر
    if (colors) {
      if (typeof colors === 'string') {
        try {
          colors = JSON.parse(colors);
        } catch (e) {
          // لو مش JSON، حاول split بالـ comma
          colors = colors.split(',').map(c => c.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(colors)) {
        return res.status(400).json({
          success: false,
          message: 'Colors must be an array'
        });
      }
    }

    if (sizes) {
      if (typeof sizes === 'string') {
        try {
          sizes = JSON.parse(sizes);
        } catch (e) {
          // لو مش JSON، حاول split بالـ comma
          sizes = sizes.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(sizes)) {
        return res.status(400).json({
          success: false,
          message: 'Sizes must be an array'
        });
      }
    }

    // Process scents
    if (scents) {
      if (typeof scents === 'string') {
        try {
          scents = JSON.parse(scents);
        } catch (e) {
          // لو مش JSON، حاول split بالـ comma
          scents = scents.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      
      if (!Array.isArray(scents)) {
        return res.status(400).json({
          success: false,
          message: 'Scents must be an array'
        });
      }
    }

    // Process size quantities
    let processedSizeQuantities = new Map();
    if (sizeQuantities) {
      if (typeof sizeQuantities === 'string') {
        try {
          sizeQuantities = JSON.parse(sizeQuantities);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Size quantities must be a valid JSON object'
          });
        }
      }
      
      if (typeof sizeQuantities === 'object' && !Array.isArray(sizeQuantities)) {
        processedSizeQuantities = new Map();
        Object.keys(sizeQuantities).forEach(size => {
          if (typeof sizeQuantities[size] === 'number' && sizeQuantities[size] >= 0) {
            processedSizeQuantities.set(size, sizeQuantities[size]);
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Size quantities must be an object with size as key and quantity as value'
        });
      }
    }

    // Process color size quantities
    let processedColorSizeQuantities = new Map();
    if (colorSizeQuantities) {
      if (typeof colorSizeQuantities === 'string') {
        try {
          colorSizeQuantities = JSON.parse(colorSizeQuantities);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Color size quantities must be a valid JSON object'
          });
        }
      }
      
      if (typeof colorSizeQuantities === 'object' && !Array.isArray(colorSizeQuantities)) {
        processedColorSizeQuantities = new Map();
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
      } else {
        return res.status(400).json({
          success: false,
          message: 'Color size quantities must be an object'
        });
      }
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
      sizes: sizes || [],   // ← إذا مفيش مقاسات يبقى array فاضي
      scents: scents || [], // ← إذا مفيش روائح يبقى array فاضي
      sizeQuantities: processedSizeQuantities, // ← الكميات لكل مقاس
      colorSizeQuantities: processedColorSizeQuantities, // ← الكميات لكل لون ومقاس
      category,
      inStock: inStock !== undefined ? inStock === 'true' || inStock === true : true,
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

// ✅ UPDATE PRODUCT (مع دعم تعديل الألوان والمقاسات والكميات والروائح)
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
      'scents',
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

    // Process scents
    if (updates.scents) {
      if (typeof updates.scents === 'string') {
        try {
          updates.scents = JSON.parse(updates.scents);
        } catch (e) {
          // لو مش JSON، حاول split بالـ comma
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

// ✅ GET ALL PRODUCTS
export const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, inStock, minPrice, maxPrice } = req.query;
    
    const query = {};
    
    if (category) query.category = category;
    if (inStock !== undefined) query.inStock = inStock === 'true';
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      populate: [
        { path: 'storeId', select: 'name email' },
        { path: 'category', select: 'name slug' }
      ],
      sort: { createdAt: -1 }
    };
    
    const products = await productsModel.paginate(query, options);
    
    res.status(200).json({
      success: true,
      products
    });
  } catch (err) {
    console.error('Get All Products Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ GET PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await productsModel.findOne({ id })
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
      product
    });
  } catch (err) {
    console.error('Get Product By ID Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    
    const product = await productsModel.findOne({ id });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const store = await storeModel.findOne({ userId, _id: product.storeId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this product'
      });
    }
    
    await productsModel.deleteOne({ id });
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    console.error('Delete Product Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};