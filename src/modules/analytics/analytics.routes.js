import express from 'express';
import {
  getOverallAnalytics,
  getStoreAnalytics,
  getSalesAnalytics,
  updateAnalytics,
  getProductAnalytics,
  getAdvancedStoreAnalytics,
  getDashboardSummary,
  getRevenueTrend,
  getTopStores,
  getOrderVolume,
  getCustomerTrend,
  getRecentActivity
} from '../analytics/analytics.controler.js';
import { protectRoutes, allowTo } from '../Auth/auth.controler.js';

const router = express.Router();

// 📊 Overall analytics (admin only)
router.get('/overall', protectRoutes, allowTo('admin'), getOverallAnalytics);

// 🏪 Store-specific analytics (store owners)
router.get('/store', protectRoutes, allowTo('store'), getStoreAnalytics);

// 📊 Advanced store analytics with chart data (store owners)
router.get('/store/advanced', protectRoutes, allowTo('store'), getAdvancedStoreAnalytics);

// 📈 Sales analytics (admin only)
router.get('/sales', protectRoutes, allowTo('admin'), getSalesAnalytics);

// 📊 Product analytics (store owners)
router.get('/product/:productId', protectRoutes, allowTo('store'), getProductAnalytics);

// 🔄 Update analytics (can be called manually or by cron)
router.post('/update', protectRoutes, allowTo('admin'), updateAnalytics);

// 📊 Admin Dashboard APIs (admin only)
router.get('/admin/summary', protectRoutes, allowTo('admin'), getDashboardSummary);
router.get('/admin/revenue-trend', protectRoutes, allowTo('admin'), getRevenueTrend);
router.get('/admin/top-stores', protectRoutes, allowTo('admin'), getTopStores);
router.get('/admin/order-volume', protectRoutes, allowTo('admin'), getOrderVolume);
router.get('/admin/customer-trend', protectRoutes, allowTo('admin'), getCustomerTrend);
router.get('/admin/recent-activity', protectRoutes, allowTo('admin'), getRecentActivity);

export default router;