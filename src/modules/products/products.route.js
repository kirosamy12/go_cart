// routes/productRoutes.js

import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByStoreUsername,
  getMyStoreProducts,
  toggleStock,
  getProductsByCategory
} from '../products/products.controler.js';
import { allowTo, protectRoutes } from '../Auth/auth.controler.js';
import { uploadArray } from '../../utils/fileUploud.js';

const router = express.Router();

// Create product
router.post('/createProduct',protectRoutes,allowTo('store'),uploadArray('images'), createProduct);

// Get all products
router.get('/get/products', getAllProducts);
router.get('/products/:slug', getProductsByCategory);

// Get single product by ID
router.get('/get/products/:id', getProductById);
router.get('/store/:username/products', getProductsByStoreUsername);
router.get('/my-store/products',protectRoutes,allowTo('store'), getMyStoreProducts);
// Update product
router.put('/products/:id',protectRoutes,allowTo('store'),uploadArray('images'), updateProduct);

// Delete product
router.delete('/deleteProduct/:id',protectRoutes,allowTo('store'), deleteProduct);
router.patch('/products/:id/toggle-stock',protectRoutes,allowTo('store'), toggleStock);
export default router;
