import orderModel from '../../../DB/models/orderModel.js';
import storeModel from '../../../DB/models/store.model.js';
import productModel from '../../../DB/models/products.model.js';
import userModel from '../../../DB/models/user.model.js';
import categoryModel from '../../../DB/models/category.model.js';
import analyticsModel from '../../../DB/models/analytics.model.js';
import mongoose from 'mongoose';

// Helper function to calculate total revenue
const calculateTotalRevenue = async (matchFilter = {}) => {
  const result = await orderModel.aggregate([
    { $match: { status: "DELIVERED", ...matchFilter } },
    { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
  ]);
  return result[0]?.totalRevenue || 0;
};

// 📊 GET OVERALL ANALYTICS
export const getOverallAnalytics = async (req, res) => {
  try {
    // 📊 Key Metrics
    const totalStores = await storeModel.countDocuments();
    const totalUsers = await userModel.countDocuments({ role: "user" });
    const totalProducts = await productModel.countDocuments();
    const totalCategories = await categoryModel.countDocuments();
    const totalOrders = await orderModel.countDocuments();
    const totalRevenue = await calculateTotalRevenue();

    // 📈 Recent Orders (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentOrders = await orderModel.find({
      createdAt: { $gte: oneWeekAgo }
    }).sort({ createdAt: -1 }).limit(10);

    // 🏬 Top Stores by Revenue
    const storeRevenues = await orderModel.aggregate([
      { $match: { status: "DELIVERED" } },
      { $group: { _id: "$storeId", revenue: { $sum: "$total" } } },
      {
        $lookup: {
          from: "stores",
          localField: "_id",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: "$store" },
      {
        $project: {
          storeName: "$store.name",
          revenue: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    // 📦 Top Products by Sales
    const topProducts = await orderModel.aggregate([
      { $match: { status: "DELIVERED" } },
      { $unwind: "$orderItems" },
      { $group: { _id: "$orderItems.productId", totalSold: { $sum: "$orderItems.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { productName: "$product.name", totalSold: 1 } },
    ]);

    // 📅 Orders by Day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ordersByDay = await orderModel.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json({
      success: true,
      data: {
        metrics: {
          totalStores,
          totalUsers,
          totalProducts,
          totalCategories,
          totalOrders,
          totalRevenue
        },
        recentOrders,
        topStores: storeRevenues,
        topProducts,
        ordersByDay
      }
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching analytics', error: err.message });
  }
};

// 🏪 STORE ANALYTICS
export const getStoreAnalytics = async (req, res) => {
  try {
    // Get user ID from the authenticated user
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID not found in token" });
    }

    console.log("Analytics - User ID:", userId);

    // Find the store associated with this user
    const store = await storeModel.findOne({ userId });
    if (!store) {
      console.log("Analytics - Store not found for user ID:", userId);
      return res.status(400).json({ success: false, message: "Store not found for this user" });
    }

    console.log("Analytics - Store found:", store.name, store._id);

    const storeId = store._id;
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // 📊 Store Metrics
    const totalOrders = await orderModel.countDocuments({ storeId: storeObjectId });
    const totalRevenue = await calculateTotalRevenue({ storeId: storeObjectId });
    const totalProducts = await productModel.countDocuments({ storeId: storeObjectId });

    // 📦 Top Selling Products
    const topProducts = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: "DELIVERED" } },
      { $unwind: "$orderItems" },
      { $group: { _id: "$orderItems.productId", totalSold: { $sum: "$orderItems.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { productName: "$product.name", totalSold: 1 } },
    ]);

    // 📅 Orders by Day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ordersByDay = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // 💰 Revenue by Category
    const revenueByCategory = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: "DELIVERED" } },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$category.name", "Uncategorized"] },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        store: {
          id: store.id,
          name: store.name,
          username: store.username
        },
        metrics: {
          totalOrders,
          totalRevenue,
          totalProducts
        },
        topProducts,
        ordersByDay,
        revenueByCategory
      }
    });
  } catch (err) {
    console.error('Store Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching store analytics', error: err.message });
  }
};

// 📈 SALES ANALYTICS
export const getSalesAnalytics = async (req, res) => {
  try {
    // 📅 Revenue by Month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const revenueByMonth = await orderModel.aggregate([
      { $match: { status: "DELIVERED", createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: { $concat: [{ $toString: "$_id.month" }, "/", { $toString: "$_id.year" }] },
          revenue: 1,
          orderCount: 1
        }
      },
      { $sort: { "month": 1 } }
    ]);

    // 🏬 Revenue by Store (top 10)
    const revenueByStore = await orderModel.aggregate([
      { $match: { status: "DELIVERED" } },
      { $group: { _id: "$storeId", revenue: { $sum: "$total" }, orderCount: { $sum: 1 } } },
      {
        $lookup: {
          from: "stores",
          localField: "_id",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: "$store" },
      {
        $project: {
          storeName: "$store.name",
          revenue: 1,
          orderCount: 1
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        revenueByMonth,
        revenueByStore
      }
    });
  } catch (err) {
    console.error('Sales Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching sales analytics', error: err.message });
  }
};

// 🔄 UPDATE ANALYTICS (for manual updates or cron jobs)
export const updateAnalytics = async (req, res) => {
  try {
    // This function would typically be called by a cron job or manually
    // to update analytics data in the analyticsModel collection
    
    // Example: Update total revenue metric
    const totalRevenue = await calculateTotalRevenue();
    await analyticsModel.findOneAndUpdate(
      { metric: "totalRevenue" },
      { 
        metric: "totalRevenue", 
        value: totalRevenue,
        date: new Date()
      },
      { upsert: true, new: true }
    );

    // Example: Update total orders metric
    const totalOrders = await orderModel.countDocuments();
    await analyticsModel.findOneAndUpdate(
      { metric: "totalOrders" },
      { 
        metric: "totalOrders", 
        value: totalOrders,
        date: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Analytics updated successfully"
    });
  } catch (err) {
    console.error('Update Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error updating analytics', error: err.message });
  }
};