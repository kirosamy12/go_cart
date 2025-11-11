import express from 'express';
import {
  createAddress,
  getUserAddresses,
  deleteAddress,
  updateAddress,
  getShippingCost,
  getAllShippingCosts,
  updateShippingCost
} from '../address/address.controler.js';
import { protectRoutes, allowTo } from '../Auth/auth.controler.js';


const router = express.Router();

// 🔒 كل الراوتات محمية

// POST /api/addresses
router.post('/v1/createAddress',protectRoutes, createAddress);

// GET /api/addresses
router.get('/address/getUserAddresses',protectRoutes, getUserAddresses);
 
// DELETE /api/addresses/:id
router.delete('/deleteAddress/:id', deleteAddress);

// PUT /api/addresses/:id
router.put('/updateAddress/:id', updateAddress);

// GET /api/addresses/shipping-cost/:governorate
router.get('/shipping-cost/:governorate', getShippingCost);

// GET /api/addresses/shipping-costs (admin only)
router.get('/shipping-costs', protectRoutes, allowTo('admin'), getAllShippingCosts);

// PUT /api/addresses/shipping-cost (admin only)
router.put('/shipping-cost', protectRoutes, allowTo('admin'), updateShippingCost);

export default router;