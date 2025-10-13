import express from 'express';
import {
  createOrder,
  getUserOrders,
   getOrderById,
  updateOrderStatus,
   getStoreOrders,
//   cancelOrder,
//   getOrderStats,
   getOrderTracking,
} from '../order/order.controler.js';
import { allowTo, isStoreOwner, protectRoutes } from '../Auth/auth.controler.js';


const router = express.Router();




// Order management
router.post('/createOrder',protectRoutes, createOrder);
router.get('/orders/getUserOrders',protectRoutes, getUserOrders);
// router.get('/stats/overview', getOrderStats);
 router.get('/order/:orderId', protectRoutes,getOrderById);

// router.put('/:orderId/cancel', cancelOrder);
 router.get('/:orderId/tracking',protectRoutes,allowTo("store"), getOrderTracking);

// // Store orders
 router.get('/store/orders',protectRoutes ,allowTo("store"), getStoreOrders);
 router.put('/:orderId/status', protectRoutes,allowTo('store'), updateOrderStatus);
export default router;
       
     
 