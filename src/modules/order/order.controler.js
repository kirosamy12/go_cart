import mongoose from "mongoose";
import userModel from "../../../DB/models/user.model.js";
import storeModel from "../../../DB/models/store.model.js";
import productModel from "../../../DB/models/products.model.js";
import orderModel from "../../../DB/models/orderModel.js";
import cartModel from "../../../DB/models/cart.model.js";
import addressModel from "../../../DB/models/address.model.js";
import couponModel from "../../../DB/models/coupon.model.js";
import invoiceModel from "../../../DB/models/invoice.model.js";
import sendEmail from "../../utils/sendEmail.js";
import { emailTemplates } from "../../utils/emailTemplates.js";

const ObjectId = mongoose.Types.ObjectId;

const toStr = v => (v ? v.toString() : v);

const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// ✅ Helper function للبحث عن المنتج
const findProduct = async (productId) => {
  // إذا كان ObjectId
  if (mongoose.Types.ObjectId.isValid(productId) && productId.toString().length === 24) {
    const product = await productModel.findById(productId);
    if (product) return product;
  }
  
  // إذا كان string id
  if (typeof productId === 'string') {
    return await productModel.findOne({ id: productId });
  }
  
  // إذا كان object
  if (productId?.id) {
    return await productModel.findOne({ id: productId.id });
  }
  
  if (productId?._id) {
    return await productModel.findById(productId._id);
  }
  
  return null;
};

// ✅ CREATE ORDER
// ✅ CREATE ORDER - Multi-Store Support
export const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    const userId = req.user._id;

    if (!paymentMethod || !["CASH", "VISA"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method. Must be CASH or VISA",
      });
    }

    // Get cart
    const cart = await cartModel.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'id name price images inStock storeId'
    });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Get address
    const address = await addressModel.findById(addressId);
    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Invalid address",
      });
    }

    // Process coupon
    let coupon = null;
    let discountPercentage = 0;
    if (couponCode) {
      coupon = await couponModel.findOne({ code: couponCode, isActive: true });
      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive coupon code",
        });
      }
      
      if (coupon.expiryDate && coupon.expiryDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Coupon has expired",
        });
      }
      
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          success: false,
          message: "Coupon usage limit reached",
        });
      }
      
      discountPercentage = coupon.discountPercentage;
    }

    // ✅ تجميع المنتجات حسب الـ store
    const itemsByStore = {};
    let orderSubtotal = 0;
    const allOrderItems = [];

    for (const item of cart.items) {
      const product = await findProduct(item.productId);
      
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.productId?.name || 'Unknown'}`,
        });
      }

      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          message: `Product out of stock: ${product.name}`,
        });
      }

      const storeId = product.storeId.toString();
      
      if (!itemsByStore[storeId]) {
        itemsByStore[storeId] = {
          storeId: product.storeId,
          items: [],
          subtotal: 0
        };
      }

      const itemTotal = item.quantity * product.price;
      orderSubtotal += itemTotal;

      const orderItem = {
        productId: product._id,
        quantity: item.quantity,
        price: product.price,
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null,
        selectedScent: item.selectedScent || null
      };

      itemsByStore[storeId].items.push(orderItem);
      itemsByStore[storeId].subtotal += itemTotal;
      allOrderItems.push(orderItem);
    }

    // ✅ حساب الخصم والـ total لكل store
    const storesArray = [];
    let totalDiscount = 0;

    for (const [storeId, storeData] of Object.entries(itemsByStore)) {
      const storeDiscount = (storeData.subtotal * discountPercentage) / 100;
      totalDiscount += storeDiscount;
      
      storesArray.push({
        storeId: storeData.storeId,
        items: storeData.items,
        subtotal: storeData.subtotal,
        discount: storeDiscount,
        total: storeData.subtotal - storeDiscount
      });
    }

    const orderTotal = orderSubtotal - totalDiscount;

    // ✅ إنشاء الـ order
    const newOrder = new orderModel({
      id: generateId(),
      userId,
      addressId,
      orderItems: allOrderItems, // كل المنتجات
      stores: storesArray, // ✅ تفاصيل كل store
      total: orderTotal,
      subtotal: orderSubtotal,
      paymentMethod,
      isPaid: paymentMethod === "CASH" ? false : true,
      isCouponUsed: !!coupon,
      coupon: coupon ? {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
        discountAmount: totalDiscount
      } : null
    });

    await newOrder.save();

    // Clear cart
    await cartModel.findOneAndDelete({ userId });

    // Update coupon usage
    if (coupon) {
      coupon.usedCount += 1;
      await coupon.save();
    }

    // ✅ إرسال emails لكل store
    try {
      const customer = await userModel.findById(userId);

      // Email للعميل
      if (customer && customer.email) {
        await sendEmail({
          to: customer.email,
          subject: `Order Confirmation - ${newOrder.id}`,
          html: `
            <h2>Order Confirmation</h2>
            <p>Dear ${customer.name},</p>
            <p>Your order has been placed successfully!</p>
            <ul>
              <li>Order ID: ${newOrder.id}</li>
              <li>Total: $${newOrder.total}</li>
              <li>Stores: ${storesArray.length}</li>
            </ul>
          `
        });
      }

      // Email لكل store
      for (const storeData of storesArray) {
        const store = await storeModel.findById(storeData.storeId);
        
        if (store && store.email) {
          await sendEmail({
            to: store.email,
            subject: `New Order - ${newOrder.id}`,
            html: `
              <h2>New Order Received</h2>
              <p>Hello ${store.name},</p>
              <p>You have received a new order #${newOrder.id}.</p>
              <ul>
                <li>Customer: ${customer?.name || "N/A"}</li>
                <li>Your Items: ${storeData.items.length}</li>
                <li>Your Total: $${storeData.total}</li>
                <li>Payment: ${newOrder.paymentMethod}</li>
              </ul>
            `
          });
        }
      }

    } catch (emailError) {
      console.error("❌ Error sending emails:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        id: newOrder.id,
        total: newOrder.total,
        stores: storesArray.length,
        status: newOrder.status,
        paymentMethod: newOrder.paymentMethod,
        isPaid: newOrder.isPaid,
        createdAt: newOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// ✅ GET USER ORDERS
export const getUserOrders = async (req, res) => {
  try {
    console.log('getUserOrders called. req.user:', req.user);
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    let userId;
    if (req.user._id) {
      userId = req.user._id;
    } else if (req.user.id) {
      const user = await userModel.findOne({ id: req.user.id.toString() });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }
      userId = user._id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: userId };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .populate('storeId', 'id name username logo')
        .populate('addressId', 'street city state country phone')
        .populate('orderItems.productId', 'id name images colors sizes scents')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),

      orderModel.countDocuments(query)
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        isCouponUsed: order.isCouponUsed,
        coupon: order.coupon,
        createdAt: order.createdAt,
        store: order.storeId,
        address: order.addressId,
        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId?.id || null,
            name: item.productId?.name || 'Unknown Product',
            images: item.productId?.images || [],
            colors: item.productId?.colors || [],
            sizes: item.productId?.sizes || [],
            scents: item.productId?.scents || []
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedScent: item.selectedScent
        }))
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get user orders error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET ORDER BY ID
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await orderModel.findOne({ id: orderId })
      .populate('storeId', 'id name username logo')
      .populate('addressId', 'street city state country phone')
      .populate('orderItems.productId', 'id name images colors sizes scents');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        isCouponUsed: order.isCouponUsed,
        coupon: order.coupon,
        createdAt: order.createdAt,
        store: order.storeId,
        address: order.addressId,
        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId?.id,
            name: item.productId?.name,
            images: item.productId?.images,
            colors: item.productId?.colors,
            sizes: item.productId?.sizes,
            scents: item.productId?.scents
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedScent: item.selectedScent
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error in getOrderById:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the order"
    });
  }
};

// ✅ GET STORE ORDERS
export const getStoreOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;
    
    const store = await storeModel.findOne({ userId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id;
    const skip = (page - 1) * limit;

    // ✅ البحث في الـ stores array
    const query = { 
      'stores.storeId': storeId 
    };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .populate('userId', 'id name email phone')
        .populate('addressId', 'street city state country phone')
        .populate('stores.items.productId', 'id name images price colors sizes scents')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),

      orderModel.countDocuments(query)
    ]);

    // ✅ فلترة المنتجات الخاصة بالـ store فقط
    const filteredOrders = orders.map(order => {
      const storeData = order.stores.find(s => s.storeId.toString() === storeId.toString());
      
      return {
        id: order.id,
        total: storeData?.total || 0, // ✅ total الخاص بالـ store
        subtotal: storeData?.subtotal || 0,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        createdAt: order.createdAt,
        customer: order.userId,
        address: order.addressId,
        orderItems: storeData?.items.map(item => ({
          product: {
            id: item.productId?.id,
            name: item.productId?.name,
            images: item.productId?.images,
            price: item.productId?.price,
            colors: item.productId?.colors,
            sizes: item.productId?.sizes,
            scents: item.productId?.scents
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedScent: item.selectedScent
        })) || []
      };
    });

    res.json({
      success: true,
      orders: filteredOrders,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get store orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};

// Continue with rest of functions...
// (Due to space limits, the file is very long - these are the critical fixes)

// ✅ UPDATE ORDER STATUS (For Store Owners - Limited Status Options)
// ✅ UPDATE ORDER STATUS (For Store Owners) - Fixed
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status - store owners can only update to specific statuses
    const allowedStatuses = ['PENDING', 'READY', 'PICKED_UP'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Store owners can only update status to: ${allowedStatuses.join(', ')}`
      });
    }

    // Find the order
    const order = await orderModel.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if the store owner owns this order
    const store = await storeModel.findOne({ userId: req.user._id || req.user.id });
    if (!store) {
      return res.status(403).json({
        success: false,
        message: "You don't have a store"
      });
    }

    // ✅ Check if store owns this order (both old and new format)
    let hasPermission = false;
    
    // Check old format (single storeId)
    if (order.storeId && order.storeId.toString() === store._id.toString()) {
      hasPermission = true;
    }
    
    // Check new format (stores array)
    if (order.stores && order.stores.length > 0) {
      const storeExists = order.stores.some(s => 
        s.storeId.toString() === store._id.toString()
      );
      if (storeExists) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this order"
      });
    }

    // Save old status for reference
    const oldStatus = order.status;

    // Update order status
    order.status = status;
    await order.save();

    // Get customer and store details for email
    const customer = await userModel.findById(order.userId);
    const storeDetails = await storeModel.findById(store._id);

    // Send professional status update email to customer
    try {
      if (customer && customer.email) {
        // Get store-specific items for email
        let storeItems = [];
        if (order.stores && order.stores.length > 0) {
          const storeData = order.stores.find(s => 
            s.storeId.toString() === store._id.toString()
          );
          if (storeData) {
            storeItems = storeData.items;
          }
        } else {
          storeItems = order.orderItems;
        }

        await sendEmail({
          to: customer.email,
          subject: `Order Status Updated - ${order.id}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Dear ${customer.name},</p>
            <p>The status of your order #${order.id} has been updated by ${storeDetails.name}.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order ID: ${order.id}</li>
              <li>Store: ${storeDetails.name}</li>
              <li>Old Status: ${oldStatus}</li>
              <li>New Status: ${status}</li>
              <li>Items from this store: ${storeItems.length}</li>
            </ul>
            <p>Thank you for shopping with us!</p>
          `
        });
      }

      // Notify admins about the status update
      const adminUsers = await userModel.find({ role: 'admin' });
      if (adminUsers && adminUsers.length > 0) {
        for (const admin of adminUsers) {
          if (admin.email) {
            try {
              await sendEmail({
                to: admin.email,
                subject: `Order Status Updated by Store - ${order.id}`,
                html: `
                  <h2>Order Status Update</h2>
                  <p>Store ${storeDetails.name} has updated the status of order #${orderId}.</p>
                  <p><strong>Order Details:</strong></p>
                  <ul>
                    <li>Order ID: ${orderId}</li>
                    <li>Store: ${storeDetails.name} (${storeDetails.username})</li>
                    <li>Old Status: ${oldStatus}</li>
                    <li>New Status: ${status}</li>
                    <li>Total Amount: $${order.total}</li>
                    <li>Payment Method: ${order.paymentMethod}</li>
                    <li>Payment Status: ${order.isPaid ? 'Paid' : 'Not Paid'}</li>
                  </ul>
                  <p>Please review this update in the admin panel.</p>
                `
              });
            } catch (adminEmailError) {
              console.error(`❌ Error sending status update email to admin ${admin.email}:`, adminEmailError);
            }
          }
        }
      }
    } catch (emailError) {
      console.error("❌ Error sending status update email notifications:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        customer: {
          id: customer?.id,
          name: customer?.name,
          email: customer?.email
        },
        store: {
          id: storeDetails?.id,
          name: storeDetails?.name,
          username: storeDetails?.username
        },
        updatedAt: order.updatedAt
      },
    });
  } catch (error) {
    console.error('❌ Update store order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while updating order status'
    });
  }
};


// ✅ UPDATE ORDER STATUS BY ADMIN (Full Status Control)
export const updateOrderStatusByAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status for admin
    const allowedStatuses = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PENDING', 'READY', 'PICKED_UP'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
      });
    }

    // Find the order and populate related data
    const order = await orderModel.findOne({ id: orderId })
      .populate('userId', 'id name email phone')
      .populate('storeId', 'id name username email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Save old status for reference
    const oldStatus = order.status;

    // Update order status
    order.status = status;
    
    // When order is delivered, payment status should be changed to paid and invoice generated
    if (status === 'DELIVERED') {
      order.isPaid = true;
      
      // Generate invoice when order is delivered
      try {
        await generateInvoice(order);
        console.log("✅ Invoice generated for delivered order:", order.id);
      } catch (invoiceError) {
        console.error("❌ Error generating invoice for order:", order.id, invoiceError);
        // Don't fail the order update if invoice generation fails
      }
    }
    
    // When order is cancelled, keep payment status as is (business logic may vary)
    if (status === 'CANCELLED') {
      // Optionally handle cancellation logic here
    }

    await order.save();

    // Send email notifications
    try {
      // Professional status update email to customer
      if (order.userId && order.userId.email) {
        const emailHtml = emailTemplates.orderStatusUpdate({
          customerName: order.userId.name,
          orderId: order.id,
          oldStatus: oldStatus,
          newStatus: order.status,
          totalAmount: order.total,
          orderItems: order.orderItems.map(item => ({
            name: item.productId?.name || 'Unknown Product',
            quantity: item.quantity,
            images: item.productId?.images || []
          }))
        });

        await sendEmail({
          to: order.userId.email,
          subject: `Order Status Updated - ${order.id}`,
          html: emailHtml
        });
      }

      // Notify store
      if (order.storeId && order.storeId.email) {
        await sendEmail({
          to: order.storeId.email,
          subject: `Order Status Updated by Admin - ${order.id}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Hello ${order.storeId.name},</p>
            <p>The status of order #${order.id} has been updated by admin.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order ID: ${order.id}</li>
              <li>Customer: ${order.userId?.name}</li>
              <li>Old Status: ${oldStatus}</li>
              <li>New Status: ${order.status}</li>
              <li>Total Amount: $${order.total}</li>
              <li>Payment Status: ${order.isPaid ? 'Paid' : 'Not Paid'}</li>
            </ul>
          `
        });
      }
    } catch (emailError) {
      console.error("❌ Error sending status update emails:", emailError);
      // Don't fail the status update if email sending fails
    }

    // Send response
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: order.id,
        oldStatus,
        newStatus: order.status,
        isPaid: order.isPaid,
        total: order.total,
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        },
        store: {
          id: order.storeId?.id,
          name: order.storeId?.name,
          username: order.storeId?.username
        },
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update store order status by admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while updating order status'
    });
  }
};


// ✅ UPDATE STORE ORDER STATUS BY ADMIN
export const updateStoreOrderStatusByAdmin = async (req, res) => {
  try {
    const { storeId, orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status for admin
    const allowedStatuses = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PENDING', 'READY', 'PICKED_UP'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
      });
    }

    // Find the store by its string id field
    const store = await storeModel.findOne({ id: storeId });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Find the order and populate related data
    const order = await orderModel.findOne({ id: orderId, storeId: store._id })
      .populate('userId', 'id name email phone')
      .populate('storeId', 'id name username email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or does not belong to this store"
      });
    }

    // Save old status for reference
    const oldStatus = order.status;

    // Update order status
    order.status = status;
    
    // When order is delivered, payment status should be changed to paid and invoice generated
    if (status === 'DELIVERED') {
      order.isPaid = true;
      
      // Generate invoice when order is delivered
      try {
        await generateInvoice(order);
        console.log("✅ Invoice generated for delivered order:", order.id);
      } catch (invoiceError) {
        console.error("❌ Error generating invoice for order:", order.id, invoiceError);
        // Don't fail the order update if invoice generation fails
      }
    }
    
    // When order is cancelled, keep payment status as is (business logic may vary)
    if (status === 'CANCELLED') {
      // Optionally handle cancellation logic here
    }

    await order.save();

    // Send email notifications
    try {
      // Professional status update email to customer
      if (order.userId && order.userId.email) {
        const emailHtml = emailTemplates.orderStatusUpdate({
          customerName: order.userId.name,
          orderId: order.id,
          oldStatus: oldStatus,
          newStatus: order.status,
          totalAmount: order.total,
          orderItems: order.orderItems.map(item => ({
            name: item.productId?.name || 'Unknown Product',
            quantity: item.quantity,
            images: item.productId?.images || []
          }))
        });

        await sendEmail({
          to: order.userId.email,
          subject: `Order Status Updated - ${order.id}`,
          html: emailHtml
        });
      }

      // Notify store
      if (order.storeId && order.storeId.email) {
        await sendEmail({
          to: order.storeId.email,
          subject: `Order Status Updated by Admin - ${order.id}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Hello ${order.storeId.name},</p>
            <p>The status of order #${order.id} has been updated by admin.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order ID: ${order.id}</li>
              <li>Customer: ${order.userId?.name}</li>
              <li>Old Status: ${oldStatus}</li>
              <li>New Status: ${status}</li>
              <li>Total Amount: $${order.total}</li>
              <li>Payment Status: ${order.isPaid ? 'Paid' : 'Not Paid'}</li>
            </ul>
          `
        });
      }
    } catch (emailError) {
      console.error("❌ Error sending status update emails:", emailError);
      // Don't fail the status update if email sending fails
    }

    // Send response
    res.json({
      success: true,
      message: 'Store order status updated successfully',
      order: {
        id: order.id,
        oldStatus,
        newStatus: order.status,
        isPaid: order.isPaid,
        total: order.total,
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        },
        store: {
          id: order.storeId?.id,
          name: order.storeId?.name,
          username: order.storeId?.username
        },
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update store order status by admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while updating store order status'
    });
  }
};


// ✅ GET COMPLETE ORDER DETAILS FOR ADMIN
export const getCompleteOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Find the order with all possible populated data
    const order = await orderModel.findOne({ id: orderId })
      .populate('userId', 'id name email phone createdAt')
      .populate('storeId', 'id name username logo email contact address status isActive createdAt')
      .populate('addressId', 'name email street city state zip country phone')
      .populate('orderItems.productId', 'id name images price colors sizes description category');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Get additional analytics data
    const orderItemCount = order.orderItems.reduce((total, item) => total + item.quantity, 0);
    
    // Calculate item-level totals
    const orderItemsWithTotals = order.orderItems.map(item => ({
      product: {
        id: item.productId.id,
        name: item.productId.name,
        images: item.productId.images,
        price: item.productId.price,
        colors: item.productId.colors,
        sizes: item.productId.sizes,
        description: item.productId.description,
        category: item.productId.category
      },
      quantity: item.quantity,
      unitPrice: item.price,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      lineTotal: item.price * item.quantity
    }));

    // Calculate order analytics
    const subtotal = orderItemsWithTotals.reduce((total, item) => total + item.lineTotal, 0);
    const discountAmount = order.coupon && order.coupon.discount ? (subtotal * order.coupon.discount / 100) : 0;
    const finalTotal = subtotal - discountAmount;

    res.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        isCouponUsed: order.isCouponUsed,
        coupon: order.coupon,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        
        // Customer information
        customer: order.userId ? {
          id: order.userId.id,
          name: order.userId.name,
          email: order.userId.email,
          phone: order.userId.phone,
          memberSince: order.userId.createdAt
        } : null,
        
        // Store information
        store: order.storeId ? {
          id: order.storeId.id,
          name: order.storeId.name,
          username: order.storeId.username,
          logo: order.storeId.logo,
          email: order.storeId.email,
          contact: order.storeId.contact,
          address: order.storeId.address,
          status: order.storeId.status,
          isActive: order.storeId.isActive,
          memberSince: order.storeId.createdAt
        } : null,
        
        // Delivery address
        deliveryAddress: order.addressId ? {
          name: order.addressId.name,
          email: order.addressId.email,
          street: order.addressId.street,
          city: order.addressId.city,
          state: order.addressId.state,
          zip: order.addressId.zip,
          country: order.addressId.country,
          phone: order.addressId.phone
        } : null,
        
        // Order items with complete details
        orderItems: orderItemsWithTotals,
        
        // Order analytics
        analytics: {
          itemCount: orderItemCount,
          uniqueItems: order.orderItems.length,
          subtotal: subtotal,
          discountAmount: discountAmount,
          finalTotal: finalTotal
        }
      }
    });

  } catch (error) {
    console.error("❌ Error in getCompleteOrderDetails:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the complete order details"
    });
  }
};


// ✅ GET ALL STORES WITH ORDERS FOR ADMIN
export const getAllStoresWithOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, storeStatus } = req.query;
    const skip = (page - 1) * limit;

    // Build store filter
    const storeFilter = {};
    if (storeStatus) storeFilter.status = storeStatus;

    // Get all stores with pagination
    const [stores, totalStores] = await Promise.all([
      storeModel.find(storeFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      storeModel.countDocuments(storeFilter)
    ]);

    // Get store IDs
    const storeIds = stores.map(store => store._id);

    // Build order filter
    const orderFilter = { storeId: { $in: storeIds } };
    if (status) orderFilter.status = status;

    // Get orders for these stores
    const orders = await orderModel.find(orderFilter)
      .populate('userId', 'id name email ')
      .populate('storeId', 'id name username contact logo')
      .sort({ createdAt: -1 })
      .lean();

    // Group orders by store
    const ordersByStore = {};
    orders.forEach(order => {
      const storeId = order.storeId._id.toString();
      if (!ordersByStore[storeId]) {
        ordersByStore[storeId] = [];
      }
      ordersByStore[storeId].push({
        id: order.id,
        total: order.total,
        status: order.status,
        isPaid: order.isPaid,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        }
      });
    });

    // Format response
    const result = stores.map(store => ({
      id: store.id,
      name: store.name,
      username: store.username,
      email: store.email,
      status: store.status,
      isActive: store.isActive,
      createdAt: store.createdAt,
      orders: ordersByStore[store._id.toString()] || [],
    }));

    // Send response
    res.json({
      success: true,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: totalStores,
        pages: Math.ceil(totalStores / limit)
      },

      result
    });

  } catch (error) {
    console.error('❌ Get all stores with orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching stores with orders'
    });
  }
};


// ✅ GET ORDER BY ID FOR STORE OWNER
// ✅ GET STORE ORDER BY ID - Fixed
export const getStoreOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Find the store for this user
    const store = await storeModel.findOne({ userId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    // ✅ Find the order - check both old storeId and new stores array
    const order = await orderModel.findOne({ 
      id: orderId,
      $or: [
        { storeId: store._id }, // ✅ للأوردرات القديمة
        { 'stores.storeId': store._id } // ✅ للأوردرات الجديدة Multi-Store
      ]
    })
      .populate('userId', 'id name email phone')
      .populate('addressId', 'name email street city state zip country phone')
      .populate('orderItems.productId', 'id name images price colors sizes description category scents')
      .populate('stores.items.productId', 'id name images price colors sizes description category scents');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or does not belong to your store"
      });
    }

    // ✅ Get store-specific data
    let storeOrderItems = [];
    let storeTotal = 0;
    let storeSubtotal = 0;

    // Check if this is a new multi-store order
    if (order.stores && order.stores.length > 0) {
      const storeData = order.stores.find(s => s.storeId.toString() === store._id.toString());
      
      if (storeData) {
        storeOrderItems = storeData.items.map(item => ({
          product: {
            id: item.productId?.id,
            name: item.productId?.name,
            images: item.productId?.images,
            price: item.productId?.price,
            colors: item.productId?.colors,
            sizes: item.productId?.sizes,
            scents: item.productId?.scents,
            description: item.productId?.description,
            category: item.productId?.category
          },
          quantity: item.quantity,
          unitPrice: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedScent: item.selectedScent,
          lineTotal: item.price * item.quantity
        }));
        
        storeTotal = storeData.total;
        storeSubtotal = storeData.subtotal;
      }
    } else {
      // Old order format - use orderItems
      storeOrderItems = order.orderItems.map(item => ({
        product: {
          id: item.productId?.id,
          name: item.productId?.name,
          images: item.productId?.images,
          price: item.productId?.price,
          colors: item.productId?.colors,
          sizes: item.productId?.sizes,
          scents: item.productId?.scents,
          description: item.productId?.description,
          category: item.productId?.category
        },
        quantity: item.quantity,
        unitPrice: item.price,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        selectedScent: item.selectedScent,
        lineTotal: item.price * item.quantity
      }));
      
      storeTotal = order.total;
      storeSubtotal = order.subtotal;
    }

    // Format the response
    res.json({
      success: true,
      order: {
        id: order.id,
        total: storeTotal, // ✅ total الخاص بالـ store
        subtotal: storeSubtotal, // ✅ subtotal الخاص بالـ store
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        isCouponUsed: order.isCouponUsed,
        coupon: order.coupon,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        
        // Customer information
        customer: order.userId ? {
          id: order.userId.id,
          name: order.userId.name,
          email: order.userId.email,
          phone: order.userId.phone
        } : null,
        
        // Delivery address
        deliveryAddress: order.addressId ? {
          name: order.addressId.name,
          email: order.addressId.email,
          street: order.addressId.street,
          city: order.addressId.city,
          state: order.addressId.state,
          zip: order.addressId.zip,
          country: order.addressId.country,
          phone: order.addressId.phone
        } : null,
        
        // Order items - only this store's items
        orderItems: storeOrderItems,
        
        // Order analytics
        analytics: {
          itemCount: storeOrderItems.reduce((total, item) => total + item.quantity, 0),
          uniqueItems: storeOrderItems.length,
          subtotal: storeSubtotal
        }
      }
    });

  } catch (error) {
    console.error("❌ Error in getStoreOrderById:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the order details"
    });
  }
};

// ✅ UPDATE ORDER STATUS AS ADMIN (NOT AS STORE OWNER)
export const updateOrderStatusAsAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ["ORDER_PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }

    // Find the order by ID with populated data
    const order = await orderModel.findOne({ id: orderId })
      .populate('userId', 'id name email')
      .populate('storeId', 'id name username email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Save old status for reference
    const oldStatus = order.status;

    // Update order status
    order.status = status;
    
    // When order is delivered, payment status should be changed to paid and invoice generated
    if (status === 'DELIVERED') {
      order.isPaid = true;
      
      // Generate invoice when order is delivered
      try {
        await generateInvoice(order);
        console.log("✅ Invoice generated for delivered order:", order.id);
      } catch (invoiceError) {
        console.error("❌ Error generating invoice for order:", order.id, invoiceError);
        // Don't fail the order update if invoice generation fails
      }
    }
    
    // When order is cancelled, keep payment status as is (business logic may vary)
    if (status === 'CANCELLED') {
      // Optionally handle cancellation logic here
    }

    await order.save();

    // Send email notifications
    try {
      // Notify customer
      if (order.userId && order.userId.email) {
        await sendEmail({
          to: order.userId.email,
          subject: `Order Status Updated - ${order.id}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Dear ${order.userId.name},</p>
            <p>The status of your order #${order.id} has been updated by admin.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order ID: ${order.id}</li>
              <li>Old Status: ${oldStatus}</li>
              <li>New Status: ${order.status}</li>
              <li>Total Amount: $${order.total}</li>
              <li>Payment Status: ${order.isPaid ? 'Paid' : 'Not Paid'}</li>
            </ul>
            <p>Thank you for shopping with us!</p>
          `
        });
      }

      // Notify store
      if (order.storeId && order.storeId.email) {
        await sendEmail({
          to: order.storeId.email,
          subject: `Order Status Updated by Admin - ${order.id}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Hello ${order.storeId.name},</p>
            <p>The status of order #${order.id} has been updated by admin.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order ID: ${order.id}</li>
              <li>Old Status: ${oldStatus}</li>
              <li>New Status: ${order.status}</li>
              <li>Total Amount: $${order.total}</li>
              <li>Payment Status: ${order.isPaid ? 'Paid' : 'Not Paid'}</li>
            </ul>
          `
        });
      }
    } catch (emailError) {
      console.error("❌ Error sending status update emails:", emailError);
      // Don't fail the status update if email sending fails
    }

    // Send response
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: order.id,
        oldStatus,
        newStatus: order.status,
        isPaid: order.isPaid,
        total: order.total,
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        },
        store: {
          id: order.storeId?.id,
          name: order.storeId?.name,
          username: order.storeId?.username
        },
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update order status as admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while updating order status'
    });
  }
};


// ✅ GET ORDER TRACKING (مع الألوان)
export const getOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const order = await orderModel.findOne({ id: orderId })
      .populate('storeId', 'id name username logo contact')
      .populate('addressId', 'street city state country phone')
      .populate('orderItems.productId', 'id name images colors sizes scents'); // ← إضافة colors, sizes, و scents

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userId = req.user.id;
    const userStore = await storeModel.findOne({ userId });
    
    const isOrderOwner = order.userId === req.user._id.toString();
    const isStoreOwner = userStore && userStore._id.toString() === order.storeId._id.toString();

    if (!isOrderOwner && !isStoreOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order'
      });
    }

    const trackingSteps = [
      {
        status: 'pending',
        label: 'Order Placed',
        description: 'Your order has been received',
        completed: true,
        timestamp: order.createdAt
      },
      {
        status: 'processing',
        label: 'Processing',
        description: 'Your order is being prepared',
        completed: ['processing', 'shipped', 'delivered'].includes(order.status),
        timestamp: order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' ? order.updatedAt : null
      },
      {
        status: 'shipped',
        label: 'Shipped',
        description: 'Your order is on the way',
        completed: ['shipped', 'delivered'].includes(order.status),
        timestamp: order.status === 'shipped' || order.status === 'delivered' ? order.updatedAt : null
      },
      {
        status: 'delivered',
        label: 'Delivered',
        description: 'Your order has been delivered',
        completed: order.status === 'delivered',
        timestamp: order.status === 'delivered' ? order.updatedAt : null
      }
    ];

    let cancelledStep = null;
    if (order.status === 'cancelled') {
      cancelledStep = {
        status: 'cancelled',
        label: 'Order Cancelled',
        description: 'Your order has been cancelled',
        completed: true,
        timestamp: order.updatedAt
      };
    }

    const completedSteps = trackingSteps.filter(step => step.completed).length;
    const totalSteps = trackingSteps.length;
    const progressPercentage = order.status === 'cancelled' ? 0 : Math.round((completedSteps / totalSteps) * 100);

    res.json({
      success: true,
      tracking: {
        orderId: order.id,
        currentStatus: order.status,
        progressPercentage,
        isPaid: order.isPaid,
        paymentMethod: order.paymentMethod,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        
        store: {
          name: order.storeId.name,
          username: order.storeId.username,
          contact: order.storeId.contact,
          logo: order.storeId.logo
        },
        
        address: order.addressId ? {
          street: order.addressId.street,
          city: order.addressId.city,
          state: order.addressId.state,
          country: order.addressId.country,
          phone: order.addressId.phone
        } : null,
        
        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            colors: item.productId.colors,
            sizes: item.productId.sizes,
            scents: item.productId.scents
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedScent: item.selectedScent,
          lineTotal: item.price * item.quantity
        })),
        
        trackingSteps,
        cancelledStep,
        completedSteps,
        totalSteps,
      }
    });

  } catch (error) {
    console.error('❌ Get order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching order tracking information'
    });
  }
};


// ✅ GET STORE ORDERS FOR ADMIN (Detailed view with full order information)
export const getAdminStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Find the store by its string id field
    const store = await storeModel.findOne({ id: storeId });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build order filter using the store's MongoDB _id
    const orderFilter = { storeId: store._id };
    if (status) orderFilter.status = status;

    // Get orders for this specific store with full details
    const [orders, total] = await Promise.all([
      orderModel.find(orderFilter)
        .populate('userId', 'id name email phone')
        .populate('addressId', 'street city state country phone')
        .populate('orderItems.productId', 'id name images price colors sizes scents')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),

      orderModel.countDocuments(orderFilter)
    ]);

    // Format orders with detailed information
    const formattedOrders = orders.map(order => ({
      id: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      
      customer: {
        id: order.userId?.id,
        name: order.userId?.name,
        email: order.userId?.email,
        phone: order.userId?.phone
      },
      
      address: order.addressId ? {
        street: order.addressId.street,
        city: order.addressId.city,
        state: order.addressId.state,
        country: order.addressId.country,
        phone: order.addressId.phone
      } : null,
      
      orderItems: order.orderItems.map(item => ({
        product: {
          id: item.productId.id,
          name: item.productId.name,
          images: item.productId.images,
          price: item.productId.price,
          colors: item.productId.colors,
          sizes: item.productId.sizes
        },
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        lineTotal: item.price * item.quantity
      }))
    }));

    res.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        username: store.username,
        email: store.email,
        status: store.status,
        isActive: store.isActive,
        createdAt: store.createdAt
      },
      orders: formattedOrders,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get admin store orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching store orders'
    });
  }
};



// ✅ GET MY ORDERS (مع الألوان)
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    
    // Handle user ID correctly for querying orders
    let userId;
    if (req.user._id) {
      // If _id exists (MongoDB ObjectId), use it directly for querying
      userId = req.user._id;
    } else if (req.user.id) {
      // If only id exists (string), convert to ObjectId for querying
      const user = await userModel.findOne({ id: req.user.id.toString() });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }
      userId = user._id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const query = { userId: userId };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10)),
      orderModel.countDocuments(query)
    ]);

    const storeIds = [...new Set(orders.map(o => toStr(o.storeId)).filter(Boolean))];
    const addressIds = [...new Set(orders.map(o => toStr(o.addressId)).filter(Boolean))];
    const productIds = [...new Set(orders.flatMap(o => o.orderItems.map(i => toStr(i.productId))).filter(Boolean))];

    const [stores, addresses, products] = await Promise.all([
      storeModel.find({ _id: { $in: storeIds } }).lean(),
      addressModel.find({ _id: { $in: addressIds } }).lean(),
      productModel.find({ _id: { $in: productIds } }).lean() // ← جلب المنتجات مع colors, sizes, و scents
    ]);

    const storeMap = {};
    stores.forEach(s => (storeMap[s._id.toString()] = s));
    const addressMap = {};
    addresses.forEach(a => (addressMap[a._id.toString()] = a));
    const productMap = {};
    products.forEach(p => (productMap[p._id.toString()] = p));

    const result = orders.map(order => ({
      id: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid,
      isCouponUsed: order.isCouponUsed,
      coupon: order.coupon,
      createdAt: order.createdAt,
      store: storeMap[toStr(order.storeId)] || null,
      address: addressMap[toStr(order.addressId)] || null,
      orderItems: order.orderItems.map(item => {
        const product = productMap[toStr(item.productId)];
        return {
          product: product ? {
            id: product.id,
            name: product.name,
            images: product.images,
            colors: product.colors, // ← الألوان المتاحة
            sizes: product.sizes, // ← المقاسات المتاحة
            scents: product.scents // ← الروائح المتاحة
          } : { id: i.productId },
          quantity: i.quantity,
          price: i.price,
          selectedColor: i.selectedColor, // ← اللون المختار
          selectedSize: i.selectedSize, // ← المقاس المختار
          selectedScent: i.selectedScent // ← الرائحة المختارة
        };
      })
    }));

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
      orders: result
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching your orders" });
  }
};


// ✅ TRACK ORDER (مع الألوان)
export const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    const order = await orderModel.findOne({ id: orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const currentUserId = req.user._id.toString();
    const isOrderOwner = toStr(order.userId) === currentUserId;


    const userStore = await storeModel.findOne({ userId: req.user.id });
    const isStoreOwner = userStore && toStr(userStore._id) === toStr(order.storeId);

    if (!isOrderOwner && !isStoreOwner) {
      return res.status(403).json({ success: false, message: "You do not have permission to view this order" });
    }

    const store = order.storeId ? await storeModel.findById(order.storeId).lean() : null;
    const address = order.addressId ? await addressModel.findById(order.addressId).lean() : null;

    const productIds = order.orderItems.map(i => i.productId).filter(Boolean);
    const products = await productModel.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach(p => (productMap[p._id.toString()] = p));

    const trackingSteps = [
      { status: "pending", label: "Order Placed", completed: true, timestamp: order.createdAt },
      { status: "processing", label: "Processing", completed: ["processing","shipped","delivered"].includes(order.status), timestamp: (["processing ","shipped","delivered"].includes(order.status) ? order.updatedAt : null) },
      { status: "shipped", label: "Shipped", completed: ["shipped","delivered"].includes(order.status), timestamp: (["shipped","delivered"].includes(order.status) ? order.updatedAt : null) },
      { status: "delivered", label: "Delivered", completed: order.status === "delivered", timestamp: (order.status === "delivered" ? order.updatedAt : null) }
    ];

    const cancelledStep = order.status === "cancelled" ? { status: "cancelled", label: "Cancelled", completed: true, timestamp: order.updatedAt } : null;
    const completedSteps = trackingSteps.filter(s => s.completed).length;
    const progressPercentage = order.status === "cancelled" ? 0 : Math.round((completedSteps / trackingSteps.length) * 100);

    res.json({
      success: true,
      tracking: {
        orderId: order.id,
        currentStatus: order.status,
        progressPercentage,
        isPaid: order.isPaid,
        paymentMethod: order.paymentMethod,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        store: store ? { id: store.id, name: store.name, username: store.username, contact: store.contact, logo: store.logo } : null,
        deliveryAddress: address || null,
        orderItems: order.orderItems.map(i => {
          const product = productMap[i.productId.toString()];
          return {
            product: product ? {
              id: product.id,
              name: product.name,
              images: product.images,
              colors: product.colors, // ← الألوان المتاحة
              sizes: product.sizes // ← المقاسات المتاحة
            } : { id: i.productId },
            quantity: i.quantity,
            price: i.price,
            selectedColor: i.selectedColor, // ← اللون المختار
            selectedSize: i.selectedSize // ← المقاس المختار
          };
        }),
        steps: order.status === "cancelled" ? [trackingSteps[0], cancelledStep] : trackingSteps,
        estimatedDelivery: order.status === "shipped" ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null
      }
    });

  } catch (error) {
    console.error("Track order error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while tracking the order" });
  }
};


// ✅ GENERATE INVOICE WHEN ORDER IS DELIVERED
const generateInvoice = async (order) => {
  try {
    console.log("🧾 Generating invoice for order:", order.id);
    
    // Get customer and store details
    const customer = await userModel.findById(order.userId);
    const store = await storeModel.findById(order.storeId);
    const address = await addressModel.findById(order.addressId);
    
    if (!customer || !store || !address) {
      throw new Error('Missing required data for invoice generation');
    }
    
    // Prepare order items for invoice
    const invoiceItems = await Promise.all(order.orderItems.map(async (item) => {
      // Get product details
      const product = await productModel.findById(item.productId);
      
      return {
        productId: item.productId,
        name: product?.name || 'Unknown Product',
        images: product?.images || [],
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.price * item.quantity,
        selectedColor: item.selectedColor || null,
        selectedSize: item.selectedSize || null,
        selectedScent: item.selectedScent || null,
        availableColors: product?.colors || [],
        availableSizes: product?.sizes || [],
        availableScents: product?.scents || []
      };
    }));
    
    // Calculate totals
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);
    
    // Create invoice
    const invoice = new invoiceModel({
      orderId: order._id,
      userId: order.userId,
      storeId: order.storeId,
      items: invoiceItems,
      subtotal: subtotal,
      total: subtotal, // For now, total equals subtotal (no tax in this system)
      billingAddress: {
        name: address.name,
        email: address.email,
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone
      },
      sellerInfo: {
        name: store.name,
        username: store.username,
        email: store.email,
        contact: store.contact,
        address: store.address
      },
      buyerInfo: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      },
      paymentMethod: order.paymentMethod,
      orderStatus: order.status,
      orderCreatedAt: order.createdAt,
      orderDeliveredAt: order.updatedAt,
      status: 'paid'
    });
    
    const savedInvoice = await invoice.save();
    console.log("✅ Invoice generated successfully:", savedInvoice.invoiceNumber);
    
    // Send professional invoice email to customer
    try {
      const emailHtml = emailTemplates.invoice({
        customerName: customer.name,
        invoiceNumber: savedInvoice.invoiceNumber,
        orderId: order.id,
        totalAmount: savedInvoice.total,
        paymentMethod: savedInvoice.paymentMethod,
        orderItems: savedInvoice.items,
        orderDate: savedInvoice.orderCreatedAt,
        dueDate: null // No due date for paid invoices
      });

      await sendEmail({
        to: customer.email,
        subject: `Invoice ${savedInvoice.invoiceNumber} - Order ${order.id}`,
        html: emailHtml
      });
      console.log("📧 Professional invoice email sent to customer:", customer.email);
    } catch (emailError) {
      console.error("❌ Error sending professional invoice email:", emailError);
    }
    
    return savedInvoice;
  } catch (error) {
    console.error("❌ Error generating invoice:", error);
    throw error;
  }
};

// ✅ GET INVOICES
export const getInvoices = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Debug logging
    console.log("Fetching invoices for user:", userId);

    // Get invoices for the user from the Invoice collection
    // Convert userId string to ObjectId for proper comparison
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [invoices, total] = await Promise.all([
      invoiceModel.find({ 
        userId: userObjectId
      })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      invoiceModel.countDocuments({ 
        userId: userObjectId
      })
    ]);

    // Return basic invoice information
    const basicInvoices = invoices.map(invoice => ({
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      total: invoice.total,
      status: invoice.status,
      createdAt: invoice.createdAt,
      sellerInfo: {
        name: invoice.sellerInfo?.name || 'Unknown Store',
        username: invoice.sellerInfo?.username || 'unknown'
      }
    }));

    // Debug logging
    console.log("Found invoices:", basicInvoices.map(i => ({ invoiceNumber: i.invoiceNumber, orderId: i.orderId })));

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: total,
      invoices: basicInvoices
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching invoices" });
  }
};


// ✅ GET INVOICE BY ID
export const getInvoiceById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    // Find the invoice by orderId
    const invoice = await invoiceModel.findOne({ orderId: orderId }).lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    // Check if the user has permission to view this invoice
    // Convert both userIds to strings for proper comparison
    if (invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You do not have permission to view this invoice"
      });
    }

    // Debug logging to see what's happening
    console.log("Invoice debug info:", {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      userId: invoice.userId.toString(),
      requestedUserId: req.user._id.toString(),
      userIdsMatch: invoice.userId.toString() === req.user._id.toString()
    });

    res.json({ success: true, invoice });
  } catch (error) {
    console.error("Get invoice by id error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching invoice" });
  }
};


// ✅ GET STORE INVOICES
export const getStoreInvoices = async (req, res) => {
  try {
    // Get store for the authenticated user
    const store = await storeModel.findOne({ userId: req.user.id });
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id.toString();
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Debug logging
    console.log("Fetching invoices for store:", storeId);

    // Get invoices for the store from the Invoice collection
    // Convert storeId string to ObjectId for proper comparison
    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    const [invoices, total] = await Promise.all([
      invoiceModel.find({ 
        storeId: storeObjectId
      })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      invoiceModel.countDocuments({ 
        storeId: storeObjectId
      })
    ]);

    // Return basic invoice information
    const basicInvoices = invoices.map(invoice => ({
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      total: invoice.total,
      status: invoice.status,
      createdAt: invoice.createdAt,
      buyerInfo: {
        name: invoice.buyerInfo?.name || 'Unknown Customer',
        email: invoice.buyerInfo?.email || 'N/A'
      }
    }));

    // Debug logging
    console.log("Found invoices:", basicInvoices.map(i => ({ invoiceNumber: i.invoiceNumber, orderId: i.orderId })));

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: total,
      invoices: basicInvoices
    });
  } catch (error) {
    console.error("Get store invoices error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching store invoices" });
  }
};


// ✅ GET STORE INVOICE BY ID
export const getStoreInvoiceById = async (req, res) => {
  try {
    // Get store for the authenticated user
    const store = await storeModel.findOne({ userId: req.user.id });
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id.toString();
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    // Find the invoice by orderId
    const invoice = await invoiceModel.findOne({ orderId: orderId }).lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    // Check if the invoice belongs to this store
    // Convert both storeIds to strings for proper comparison
    if (invoice.storeId.toString() !== storeId) {
      return res.status(403).json({ 
        success: false, 
        message: "You do not have permission to view this invoice"
      });
    }

    // Debug logging to see what's happening
    console.log("Invoice debug info:", {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      storeId: invoice.storeId.toString(),
      requestedStoreId: storeId,
      storeIdsMatch: invoice.storeId.toString() === storeId
    });

    res.json({ success: true, invoice });
  } catch (error) {
    console.error("Get store invoice by id error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching invoice" });
  }
};


const calculateTotalRevenue = async (matchFilter = {}) => {
  const result = await orderModel.aggregate([
    { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }, ...matchFilter } },
    { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
  ]);
  return result[0]?.totalRevenue || 0;
};

// ===================================================
// 🧭 STORE DASHBOARD
// ===================================================
export const getStoreDashboard = async (req, res) => {
  try {
    // Get store for the authenticated user
    const store = await storeModel.findOne({ userId: req.user.id });
    if (!store) {
      return res.status(400).json({ message: "Store not found for this user" });
    }

    const storeId = store._id;
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // 🧮 Total Orders Count
    const totalOrders = await orderModel.countDocuments({ storeId: storeObjectId });

    // 💰 Total Revenue
    const totalRevenue = await calculateTotalRevenue({ storeId: storeObjectId });

    // 📦 Total Products
    const totalProducts = await productModel.countDocuments({ storeId: storeObjectId });

    // 🏆 Top Selling Product
    const topProduct = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      { $unwind: "$orderItems" },
      { $group: { _id: "$orderItems.productId", totalSold: { $sum: "$orderItems.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 1 },
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

    // 📊 Monthly Sales Data
    const monthlySales = await orderModel.aggregate([
      { $match: { storeId: storeObjectId, status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$total" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    // 📅 Recent Orders (last 5 orders)
    const recentOrders = await orderModel.find({ storeId: storeObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'id name email')
      .select('id total status createdAt');

    // 📊 Sales Analytics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const salesAnalytics = await orderModel.aggregate([
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
      { $sort: { "_id": 1 } },
      { $limit: 30 }
    ]);

    // 🕒 Recent Activity (last 5 updated orders)
    const recentActivity = await orderModel.find({ storeId: storeObjectId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('id status updatedAt');

    // ⏳ Pending Orders (orders with status ORDER_PLACED or PROCESSING)
    const pendingOrders = await orderModel.find({ 
      storeId: storeObjectId, 
      status: { $in: ["ORDER_PLACED", "PROCESSING"] } 
    }).sort({ createdAt: -1 })
    .populate('userId', 'id name email')
    .select('id total status createdAt');

    res.json({
      success: true,
      data: {
        // Store information
        store: {
          id: store.id,
          name: store.name,
          username: store.username,
          logo: store.logo,
          status: store.status,
          isActive: store.isActive
        },
        
        // Key metrics
        metrics: {
          totalOrders,
          totalRevenue,
          totalProducts,
          topProduct: topProduct[0] || null
        },
        
        // Monthly sales chart data
        monthlySales,
        
        // Recent Orders Section
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          total: order.total,
          status: order.status,
          customer: {
            name: order.userId?.name || 'Unknown',
            email: order.userId?.email || 'N/A'
          },
          createdAt: order.createdAt
        })),
        
        // Sales Analytics Section
        salesAnalytics,
        
        // Recent Activity Section
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          status: activity.status,
          updatedAt: activity.updatedAt
        })),
        
        // Pending Orders Section
        pendingOrders: pendingOrders.map(order => ({
          id: order.id,
          total: order.total,
          status: order.status,
          customer: {
            name: order.userId?.name || 'Unknown',
            email: order.userId?.email || 'N/A'
          },
          createdAt: order.createdAt
        }))
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching store dashboard", error: err.message });
  }
};

// ✅ GET STORE SUCCESSFUL ORDERS (Delivered and Paid only)
export const getStoreSuccessfulOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    
    const store = await storeModel.findOne({ userId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id.toString();
    const skip = (page - 1) * limit;

    const query = { 
      storeId: storeId.toString(),
      status: 'DELIVERED',
      isPaid: true
    };

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .populate('userId', 'id name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),

      orderModel.countDocuments(query)
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        total: order.total,
        createdAt: order.createdAt,
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        }
      })),

      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get store successful orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching store successful orders'
    });
  }
};

// ✅ GET STORE SUCCESSFUL ORDER BY ID
export const getStoreSuccessfulOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    const userId = req.user.id;
    const store = await storeModel.findOne({ userId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id.toString();

    // Get delivered and paid order by ID that belongs to this store
    const order = await orderModel.findOne({ 
      id: orderId, 
      storeId: storeId,
      status: 'DELIVERED', 
      isPaid: true 
    })
      .populate('userId', 'id name email phone')
      .populate('addressId', 'street city state country phone')
      .populate('orderItems.productId', 'id name images price colors sizes')
      .lean();

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Successful order not found or does not belong to your store" 
      });
    }

    // Format the response with complete order details
    const formattedOrder = {
      id: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid,
      createdAt: order.createdAt,
      deliveredAt: order.updatedAt,

      customer: {
        id: order.userId?.id,
        name: order.userId?.name,
        email: order.userId?.email,
        phone: order.userId?.phone
      },

      address: order.addressId,

      orderItems: order.orderItems.map(item => ({
        product: {
          id: item.productId.id,
          name: item.productId.name,
          images: item.productId.images,
          price: item.productId.price,
          colors: item.productId.colors,
          sizes: item.productId.sizes,
          scents: item.productId.scents
        },
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        selectedScent: item.selectedScent,
        lineTotal: item.price * item.quantity
      }))
    };

    res.json({
      success: true,
      order: formattedOrder
    });

  } catch (error) {
    console.error('❌ Get store successful order by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching order details'
    });
  }
};

// ===================================================
// 🧭 ADMIN DASHBOARD
// ===================================================
export const getAdminDashboard = async (req, res) => {
  try {
    // 🏬 Total Stores
    const totalStores = await storeModel.countDocuments();

    // 👥 Total Users
    const totalUsers = await userModel.countDocuments({ role: "user" });

    // 💸 Total Revenue (from all orders)
    const totalRevenue = await calculateTotalRevenue();

    // 🧾 Total Orders
    const totalOrders = await orderModel.countDocuments();

    // 📦 Total Products
    const totalProducts = await productModel.countDocuments();

    // 💰 Store Revenue Comparison
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
    ]);

    // 🏆 Top Store by Sales
    const topStore = storeRevenues[0] || null;

    // 📈 Monthly Revenue Growth Rate
    const monthlyRevenue = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$total" },
          count: { $sum: 1 }
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    // 📊 Sales Analytics by Status
    const salesByStatus = await orderModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: "$total" }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // 📅 Recent Sales (Last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentSales = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo },
          status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          dailyRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 💳 Payment Method Analytics
    const paymentMethodStats = await orderModel.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: "$total" }
        }
      }
    ]);

    // 🏪 Store Information with Product Counts
    const storesWithProducts = await storeModel.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "storeId",
          as: "products",
        },
      },
      {
        $project: {
          id: 1,
          name: 1,
          username: 1,
          email: 1,
          status: 1,
          isActive: 1,
          createdAt: 1,
          productCount: { $size: "$products" },
          products: {
            $slice: ["$products", 5] // Limit to first 5 products for preview
          }
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // 📊 Store Status Statistics
    const storeStatusStats = await storeModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalStores,
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue,
        storeRevenues,
        topStore,
        monthlyRevenue,
        salesByStatus,
        recentSales,
        paymentMethodStats,
        storesWithProducts: {
          count: storesWithProducts.length,
          stores: storesWithProducts
        },
        storeStatusStats
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching admin dashboard", error: err.message });
  }
};

// ✅ GET ALL ORDERS FOR ADMIN
export const getAllOrdersForAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Get all orders with optional status filter
    const [orders, total] = await Promise.all([
      orderModel.find(filter)
        .populate('userId', 'id name email')
        .populate('storeId', 'id name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),

      orderModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        total: order.total,
        status: order.status,
        isPaid: order.isPaid,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        
        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email
        },
        
        store: {
          id: order.storeId?.id,
          name: order.storeId?.name,
          username: order.storeId?.username
        }
      })),

      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get all orders for admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching orders'
    });
  }
};

// ✅ GET SUCCESSFUL ORDERS (Delivered and Paid)
export const getSuccessfulOrders = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get delivered and paid orders for the user
    const [orders, total] = await Promise.all([
      orderModel.find({ 
        userId: userId, 
        status: 'DELIVERED', 
        isPaid: true 
      })
        .populate('storeId', 'id name username logo')
        .populate('addressId', 'street city state country phone')
        .populate('orderItems.productId', 'id name images price colors sizes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),

      orderModel.countDocuments({ 
        userId: userId, 
        status: 'DELIVERED', 
        isPaid: true 
      })
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        createdAt: order.createdAt,
        deliveredAt: order.updatedAt, // Assuming updatedAt is when it was delivered

        store: order.storeId,
        address: order.addressId,

        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            price: item.productId.price,
            colors: item.productId.colors,
            sizes: item.productId.sizes
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize
        }))
      })),

      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get successful orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching successful orders'
    });
  }
};

// ✅ GET SUCCESSFUL ORDER BY ID
export const getSuccessfulOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    // Get delivered and paid order by ID
    const order = await orderModel.findOne({ 
      id: orderId, 
      status: 'DELIVERED', 
      isPaid: true 
    })
      .populate('userId', 'id name email phone')
      .populate('storeId', 'id name username logo email contact address')
      .populate('addressId', 'street city state country phone')
      .populate('orderItems.productId', 'id name images price colors sizes')
      .lean();

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Successful order not found" 
      });
    }

    // Format the response with complete order details
    const formattedOrder = {
      id: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid,
      createdAt: order.createdAt,
      deliveredAt: order.updatedAt,

      customer: {
        id: order.userId?.id,
        name: order.userId?.name,
        email: order.userId?.email,
        phone: order.userId?.phone
      },

      store: order.storeId,
      address: order.addressId,

      orderItems: order.orderItems.map(item => ({
        product: {
          id: item.productId.id,
          name: item.productId.name,
          images: item.productId.images,
          price: item.productId.price,
          colors: item.productId.colors,
          sizes: item.productId.sizes
        },
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        lineTotal: item.price * item.quantity
      }))
    };

    res.json({
      success: true,
      order: formattedOrder
    });

  } catch (error) {
    console.error('❌ Get successful order by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching order details'
    });
  }
};

// ✅ GET ALL SUCCESSFUL ORDERS (Delivered and Paid) - For Admin
export const getAllSuccessfulOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get all delivered and paid orders
    const [orders, total] = await Promise.all([
      orderModel.find({ 
        status: 'DELIVERED', 
        isPaid: true 
      })
        .populate('userId', 'id name email phone')
        .populate('storeId', 'id name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),

      orderModel.countDocuments({ 
        status: 'DELIVERED', 
        isPaid: true 
      })
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        createdAt: order.createdAt,
        deliveredAt: order.updatedAt, // Assuming updatedAt is when it was delivered

        customer: {
          id: order.userId?.id,
          name: order.userId?.name,
          email: order.userId?.email,
          phone: order.userId?.phone
        },
        
        store: {
          id: order.storeId?.id,
          name: order.storeId?.name,
          username: order.storeId?.username
        }
      })),

      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get all successful orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching successful orders'
    });
  }
};



// End of file
