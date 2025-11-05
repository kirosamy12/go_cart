import express from 'express';
import {
    createCart,
    getCart,
    updateCart,
    deleteCart,
    addToCart,
    removeItemFromCart

} from './cart.controler.js';
import { protectRoutes } from '../Auth/auth.controler.js';

const router = express.Router(); 

router.get('/myCart/my',protectRoutes, getCart);                     // Get cart
router.post('/createCart',protectRoutes, createCart);                        // Create new cart
router.patch('/updateCart', protectRoutes,updateCart);                  // Replace items
router.patch('/addToCart',protectRoutes, addToCart);             // Add or update one item
// Fixed route for removing item from cart - Express v5 compatible
router.patch('/removeFromCart/:productId/:color/:size', protectRoutes, removeItemFromCart); // Remove one item
router.patch('/removeFromCart/:productId/:color', protectRoutes, removeItemFromCart); // Remove one item (no size)
router.patch('/removeFromCart/:productId', protectRoutes, removeItemFromCart); // Remove one item (no color/size)
router.delete('/:userId', deleteCart); 

export default router;