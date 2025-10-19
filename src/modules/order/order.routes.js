import express from 'express';
import {
  createOrder,
  getUserOrders,
   getOrderById,
  updateOrderStatus,
   getStoreOrders,
//   cancelOrder,
//   getOrderStats,
getMyOrders,
  trackOrder,
  getInvoices,
  getInvoiceById,
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

 router.get("/use/order/myOrders", protectRoutes, getMyOrders);
 router.get("/track/:orderId", protectRoutes, trackOrder);
 
 // فواتير المستخدم
 router.get("/order/invoices", protectRoutes, getInvoices);
 router.get("/order/invoice/:orderId", protectRoutes, getInvoiceById);
 


export default router;
       
     
 