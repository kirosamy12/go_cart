// src/modules/review/review.routes.js
import express from 'express';
import { 
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getUserReviews
} from './review.controler.js';
import { protectRoutes } from '../Auth/auth.controler.js';

const router = express.Router();

// All routes are protected
router.use(protectRoutes);

// 🟢 Review routes
router.post('/createReview',protectRoutes, createReview);                    // Create review
router.get('/product/productReviews/:productId',protectRoutes, getProductReviews); // Get reviews for a product
router.put('/updateReview/:reviewId', protectRoutes,updateReview);           // Update review
router.delete('/deleteReview/:reviewId', protectRoutes,deleteReview);        // Delete review
router.get('/my-reviews',protectRoutes, getUserReviews);        // Get current user's reviews

export default router;