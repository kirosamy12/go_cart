import express from 'express';
import {
    createCart,
    getCart,
    updateCart,
    deleteCart,
    addToCart,
    removeItemFromCart

} from '../cart/cart.controler.js';
import { protectRoutes } from '../Auth/auth.controler.js';

const router = express.Router(); 

router.get('/myCart/my',protectRoutes, getCart);                     // Get cart
router.post('/createCart',protectRoutes, createCart);                        // Create new cart
router.patch('/updateCart', protectRoutes,updateCart);                  // Replace items
router.patch('/addToCart',protectRoutes, addToCart);             // Add or update one item
router.patch('/removeFromCart/:productId', removeItemFromCart); // Remove one item
router.delete('/:userId', deleteCart); 








export default router;
