// routes/categoryRoutes.js
import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
} from '../category/category.controler.js';
import { allowTo, protectRoutes } from '../Auth/auth.controler.js';
import { uploadSingle } from '../../utils/fileUploud.js';

const router = express.Router();

// POST /api/categories
router.post('/createCategory',protectRoutes,allowTo('admin'),uploadSingle('image'), createCategory);
 
// GET /api/categories
router.get('/getAllCategories', getAllCategories);

// GET /api/categories/:slug
router.get('/getCategoryBySlug/:slug', getCategoryBySlug);

// PUT /api/categories/:slug
router.put('/updateCategory/:slug',protectRoutes,allowTo('store'), updateCategory);

// DELETE /api/categories/:slug
router.delete('/deleteCategory/:slug',protectRoutes,allowTo('store'), deleteCategory);

export default router;
