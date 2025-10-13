import express from 'express';
import {
  createAddress,
  getUserAddresses,
  deleteAddress,
  updateAddress
} from '../address/address.controler.js';
import { protectRoutes } from '../Auth/auth.controler.js';


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

export default router;
