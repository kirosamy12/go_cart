import express from 'express';
import {
  createOrder,
  getUserOrders,
   getOrderById,
  updateOrderStatus,
   getStoreOrders,
   getAdminDashboard,
   getStoreDashboard,
//   cancelOrder,
//   getOrderStats,
getMyOrders,
  trackOrder,
  getInvoices,
  getInvoiceById,
   getOrderTracking,
   getSuccessfulOrders,
   getAllOrdersForAdmin,
   getAllSuccessfulOrders,
   getSuccessfulOrderById,
   getStoreSuccessfulOrders,
   getStoreSuccessfulOrderById,
   getStoreInvoices,
   getStoreInvoiceById,
   // New admin functions
   getAllStoresWithOrders,
   updateOrderStatusAsAdmin
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
 router.get('/store/orders/successful',protectRoutes ,allowTo("store"), getStoreSuccessfulOrders);
 router.get('/store/orders/successful/:orderId',protectRoutes ,allowTo("store"), getStoreSuccessfulOrderById);
 router.put('/:orderId/status', protectRoutes,allowTo('store'), updateOrderStatus);

 router.get("/use/order/myOrders", protectRoutes, getMyOrders);
 router.get("/track/:orderId", protectRoutes, trackOrder);

 // Invoices
 router.get("/kiro/order/invoices", protectRoutes, getInvoices);
 router.get("/order/invoice/:orderId", protectRoutes, getInvoiceById);

 // Store Invoices
 router.get("/store/invoices", protectRoutes, allowTo("store"), getStoreInvoices);
 router.get("/store/invoice/:orderId", protectRoutes, allowTo("store"), getStoreInvoiceById);

 // Successful delivered orders for user
 router.get("/orders/successful", protectRoutes, getSuccessfulOrders);

 // All orders for admin
 router.get("/orders/all", protectRoutes, allowTo("admin"), getAllOrdersForAdmin);

 // All successful orders for admin
 router.get("/orders/successful/all", protectRoutes, allowTo("admin"), getAllSuccessfulOrders);

 // Get specific successful order by ID for admin
 router.get("/orders/successful/:orderId", protectRoutes, allowTo("admin"), getSuccessfulOrderById);

 // New admin routes
 router.get("/admin/stores-with-orders", protectRoutes, allowTo("admin"), getAllStoresWithOrders);
 router.put("/admin/order/:orderId/status", protectRoutes, allowTo("admin"), updateOrderStatusAsAdmin);

 router.get("/admin/dashboard", protectRoutes, allowTo("admin"), getAdminDashboard);
 router.get("/dashbord/store", protectRoutes, allowTo("store"), getStoreDashboard);

export default router;