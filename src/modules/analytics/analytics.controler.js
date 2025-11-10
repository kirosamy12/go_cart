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
    { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }, ...matchFilter } },
    { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
  ]);
  return result[0]?.totalRevenue || 0;
};

// Helper function to get quarterly date ranges
const getQuarterlyRanges = () => {
  const now = new Date();
  const quarters = [];
  
  for (let i = 0; i < 4; i++) {
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - (i * 3), 1);
    const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
    
    quarters.push({
      quarter: Math.floor(quarterStart.getMonth() / 3) + 1,
      year: quarterStart.getFullYear(),
      startDate: quarterStart,
      endDate: quarterEnd
    });
  }
  
  return quarters.reverse(); // Return in chronological order
};

// Helper function to calculate growth rate
const calculateGrowthRate = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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

    // 📊 Revenue by Category
    const revenueByCategory = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
        ordersByDay,
        revenueByCategory
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
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
      { $match: { storeId: storeObjectId, createdAt: { $gte: thirtyDaysAgo }, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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

    // 📊 Quarterly Sales Report
    const quarterlyReports = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            quarter: {
              $ceil: { $divide: [{ $month: "$createdAt" }, 3] }
            }
          },
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$total" }
        }
      },
      {
        $project: {
          _id: 0,
          quarter: { $concat: ["Q", { $toString: "$_id.quarter" }] },
          year: "$_id.year",
          totalRevenue: 1,
          totalOrders: 1,
          averageOrderValue: { $round: ["$averageOrderValue", 2] }
        }
      },
      { $sort: { year: -1, "quarter": -1 } },
      { $limit: 4 }
    ]);

    // 📈 Product Performance Metrics
    const productPerformance = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          avgPrice: { $avg: "$orderItems.price" }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productName: "$product.name",
          totalSold: 1,
          totalRevenue: 1,
          avgPrice: { $round: ["$avgPrice", 2] },
          revenuePercentage: {
            $multiply: [
              { 
                $divide: [
                  { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
                  totalRevenue || 1
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // 📊 Sales Growth (Month over Month)
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const previousMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    
    const currentMonthRevenue = await calculateTotalRevenue({
      storeId: storeObjectId,
      createdAt: { $gte: currentMonthStart }
    });
    
    const previousMonthRevenue = await calculateTotalRevenue({
      storeId: storeObjectId,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    
    const monthOverMonthGrowth = calculateGrowthRate(currentMonthRevenue, previousMonthRevenue);

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
          totalProducts,
          monthOverMonthGrowth: monthOverMonthGrowth.toFixed(2) + "%"
        },
        topProducts,
        ordersByDay,
        revenueByCategory,
        quarterlyReports,
        productPerformance
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
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }, createdAt: { $gte: twelveMonthsAgo } } },
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
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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

    // 📊 Market Share Analysis
    const totalPlatformRevenue = await calculateTotalRevenue();
    
    const marketShare = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
          marketShare: {
            $multiply: [
              {
                $divide: ["$revenue", totalPlatformRevenue || 1]
              },
              100
            ]
          }
        },
      },
      { $sort: { revenue: -1 } }
    ]);

    // 📈 Quarterly Platform Performance
    const quarterlyPerformance = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            quarter: {
              $ceil: { $divide: [{ $month: "$createdAt" }, 3] }
            }
          },
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          quarter: { $concat: ["Q", { $toString: "$_id.quarter" }, " ", { $toString: "$_id.year" }] },
          totalRevenue: 1,
          totalOrders: 1
        }
      },
      { $sort: { "quarter": -1 } },
      { $limit: 8 }
    ]);

    res.json({
      success: true,
      data: {
        revenueByMonth,
        revenueByStore,
        marketShare,
        quarterlyPerformance
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

// 📊 PRODUCT ANALYTICS
export const getProductAnalytics = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);
    
    // Get product details
    const product = await productModel.findById(productObjectId)
      .populate('storeId', 'name')
      .populate('category', 'name');
      
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Sales performance
    const salesData = await orderModel.aggregate([
      { $unwind: "$orderItems" },
      { $match: { "orderItems.productId": productObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          unitsSold: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
        }
      },
      {
        $project: {
          _id: 0,
          period: { $concat: [{ $toString: "$_id.month" }, "/", { $toString: "$_id.year" }] },
          unitsSold: 1,
          revenue: 1
        }
      },
      { $sort: { "period": 1 } }
    ]);

    // Revenue contribution to store
    const storeRevenue = await calculateTotalRevenue({ storeId: product.storeId });
    const productRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
    const revenueContribution = storeRevenue > 0 ? (productRevenue / storeRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          store: product.storeId.name,
          category: product.category?.name || "Uncategorized"
        },
        salesData,
        metrics: {
          totalUnitsSold: salesData.reduce((sum, item) => sum + item.unitsSold, 0),
          totalRevenue: productRevenue,
          revenueContribution: revenueContribution.toFixed(2) + "%"
        }
      }
    });
  } catch (err) {
    console.error('Product Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching product analytics', error: err.message });
  }
};

// 📊 ADVANCED STORE ANALYTICS WITH CHART DATA
export const getAdvancedStoreAnalytics = async (req, res) => {
  try {
    // Get user ID from the authenticated user
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID not found in token" });
    }

    // Find the store associated with this user
    const store = await storeModel.findOne({ userId });
    if (!store) {
      return res.status(400).json({ success: false, message: "Store not found for this user" });
    }

    const storeId = store._id;
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // 📊 Revenue Trend (Last 12 Months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const revenueTrend = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [
              { $arrayElemAt: [
                ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                "$_id.month"
              ]},
              " ",
              { $toString: "$_id.year" }
            ]
          },
          revenue: 1,
          orders: 1
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 📦 Product Sales Distribution
    const productSalesDistribution = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          label: "$product.name",
          value: "$totalRevenue"
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // 📅 Order Volume by Day of Week
    const orderVolumeByDay = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          label: {
            $arrayElemAt: [
              ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
              "$_id"
            ]
          },
          value: "$count"
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // 📊 Customer Acquisition Trend (New Customers)
    const customerAcquisition = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      { $group: { _id: "$userId", firstOrder: { $min: "$createdAt" } } },
      {
        $group: {
          _id: {
            year: { $year: "$firstOrder" },
            month: { $month: "$firstOrder" }
          },
          newCustomers: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [
              { $arrayElemAt: [
                ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                "$_id.month"
              ]},
              " ",
              { $toString: "$_id.year" }
            ]
          },
          value: "$newCustomers"
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.json({
      success: true,
      data: {
        revenueTrend: {
          labels: revenueTrend.map(item => item.label),
          datasets: [
            {
              label: "Revenue",
              data: revenueTrend.map(item => item.revenue),
              borderColor: "#4CAF50",
              backgroundColor: "rgba(76, 175, 80, 0.1)"
            },
            {
              label: "Orders",
              data: revenueTrend.map(item => item.orders),
              borderColor: "#2196F3",
              backgroundColor: "rgba(33, 150, 243, 0.1)"
            }
          ]
        },
        productSalesDistribution: {
          labels: productSalesDistribution.map(item => item.label),
          datasets: [{
            data: productSalesDistribution.map(item => item.value),
            backgroundColor: [
              "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", 
              "#FF9F40", "#FF6384", "#C9CBCF", "#4BC0C0", "#FF6384"
            ]
          }]
        },
        orderVolumeByDay: {
          labels: orderVolumeByDay.map(item => item.label),
          datasets: [{
            label: "Orders",
            data: orderVolumeByDay.map(item => item.value),
            backgroundColor: "#36A2EB"
          }]
        },
        customerAcquisition: {
          labels: customerAcquisition.map(item => item.label),
          datasets: [{
            label: "New Customers",
            data: customerAcquisition.map(item => item.value),
            borderColor: "#FF6384",
            backgroundColor: "rgba(255, 99, 132, 0.1)"
          }]
        }
      }
    });
  } catch (err) {
    console.error('Advanced Store Analytics Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching advanced store analytics', error: err.message });
  }
};

// 📊 GET DASHBOARD SUMMARY
export const getDashboardSummary = async (req, res) => {
  try {
    // Get key metrics for the dashboard
    const totalRevenue = await calculateTotalRevenue();
    const totalOrders = await orderModel.countDocuments();
    const totalProducts = await productModel.countDocuments();
    const totalStores = await storeModel.countDocuments();

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalStores
      }
    });
  } catch (err) {
    console.error('Dashboard Summary Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching dashboard summary', error: err.message });
  }
};

// 📈 GET REVENUE TREND
export const getRevenueTrend = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // 'monthly' or 'weekly'
    
    let dateRange, dateFormat;
    const now = new Date();
    
    if (period === 'weekly') {
      // Last 12 weeks
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);
      dateRange = twelveWeeksAgo;
      dateFormat = "%Y-%U"; // Year and week number
    } else {
      // Last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      dateRange = twelveMonthsAgo;
      dateFormat = "%Y-%m"; // Year and month
    }

    const revenueTrend = await orderModel.aggregate([
      { 
        $match: { 
          status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }, 
          createdAt: { $gte: dateRange } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" }
          },
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          revenue: 1,
          orderCount: 1
        }
      },
      { $sort: { "period": 1 } }
    ]);

    res.json({
      success: true,
      data: revenueTrend
    });
  } catch (err) {
    console.error('Revenue Trend Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching revenue trend', error: err.message });
  }
};

// 🏬 GET TOP PERFORMING STORES
export const getTopStores = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Calculate total platform revenue
    const totalPlatformRevenue = await calculateTotalRevenue();
    
    // Get top stores by revenue
    const topStores = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
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
          storeId: "$_id",
          storeName: "$store.name",
          storeUsername: "$store.username",
          revenue: 1,
          orderCount: 1,
          contribution: {
            $multiply: [
              {
                $divide: ["$revenue", totalPlatformRevenue || 1]
              },
              100
            ]
          }
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topStores
    });
  } catch (err) {
    console.error('Top Stores Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching top stores', error: err.message });
  }
};

// 📦 GET ORDER VOLUME BY DAY
export const getOrderVolume = async (req, res) => {
  try {
    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orderVolume = await orderModel.aggregate([
      { 
        $match: { 
          status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] },
          createdAt: { $gte: thirtyDaysAgo } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1
        }
      },
      { $sort: { "date": 1 } }
    ]);

    res.json({
      success: true,
      data: orderVolume
    });
  } catch (err) {
    console.error('Order Volume Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching order volume', error: err.message });
  }
};

// 👥 GET CUSTOMER ACQUISITION TREND
export const getCustomerTrend = async (req, res) => {
  try {
    // Last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const customerTrend = await userModel.aggregate([
      { 
        $match: { 
          role: "user",
          createdAt: { $gte: twelveMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          newCustomers: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: "$_id",
          newCustomers: 1
        }
      },
      { $sort: { "month": 1 } }
    ]);

    res.json({
      success: true,
      data: customerTrend
    });
  } catch (err) {
    console.error('Customer Trend Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching customer trend', error: err.message });
  }
};

// 📝 GET RECENT ACTIVITIES
export const getRecentActivity = async (req, res) => {
  try {
    // Get recent activities from different collections
    const recentOrders = await orderModel.find({ status: "DELIVERED" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email')
      .populate('storeId', 'name');
      
    const recentStores = await storeModel.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(5);
      
    const recentProducts = await productModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('storeId', 'name');

    // Format activities
    const activities = [
      ...recentOrders.map(order => ({
        id: order._id,
        type: "order_delivered",
        title: `Order #${order._id.toString().substr(-6)} delivered`,
        description: `Order delivered to ${order.userId?.name || 'Customer'} from ${order.storeId?.name || 'Store'}`,
        timestamp: order.createdAt,
        value: order.total
      })),
      ...recentStores.map(store => ({
        id: store._id,
        type: "new_store",
        title: `New store approved`,
        description: `Store "${store.name}" has been approved`,
        timestamp: store.createdAt
      })),
      ...recentProducts.map(product => ({
        id: product._id,
        type: "new_product",
        title: `New product added`,
        description: `Product "${product.name}" added to ${product.storeId?.name || 'Store'}`,
        timestamp: product.createdAt
      }))
    ];

    // Sort by timestamp and take top 10
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivities = activities.slice(0, 10);

    res.json({
      success: true,
      data: recentActivities
    });
  } catch (err) {
    console.error('Recent Activity Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching recent activities', error: err.message });
  }
};
