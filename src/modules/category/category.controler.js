// controllers/categoryController.js
import slugify from 'slugify';
import categoryModel from '../../../DB/models/category.model.js';

// ✅ CREATE
export const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const existing = await categoryModel.findOne({ name });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }

    const category = new categoryModel({
      name,
      slug: slugify(name, { lower: true }),
      description,
      image
    });

    await category.save();

    res.status(201).json({ success: true, message: 'Category created successfully', category });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ GET ALL
export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: categories.length, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ GET SINGLE
export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await categoryModel.findOne({ slug });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error('Get Category Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ UPDATE
export const updateCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, description, image, isActive } = req.body;

    const category = await categoryModel.findOne({ slug });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name) {
      category.name = name;
      category.slug = slugify(name, { lower: true });
    }

    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({ success: true, message: 'Category updated', category });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ DELETE
export const deleteCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await categoryModel.findOneAndDelete({ slug });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
