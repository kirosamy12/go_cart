import storeModel from"../../../DB/models/store.model.js"
import addressModel from"../../../DB/models/address.model.js"
import productModel from"../../../DB/models/products.model.js"
import orderModel from "../../../DB/models/orderModel.js";
import cartModel from "../../../DB/models/cart.model.js";
import mongoose from "mongoose";
import userModel from "../../../DB/models/user.model.js";
const ObjectId = mongoose.Types.ObjectId;


const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};


export const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;

    const userId = req.user._id; // ✅ استخدم ObjectId مباشرة

    console.log("🧩 Debug Info:");
    console.log("addressId:", addressId);
    console.log("userId from token:", userId);

    // ✅ تحقق من paymentMethod
    if (!paymentMethod || !["CASH", "VISA"].includes(paymentMethod)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid payment method. Must be CASH or VISA" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address ID format" });
    }

    const address = await addressModel.findById(addressId);
 
    if (!address) {
      console.log("🔍 Address found: ❌ NO");
      return res.status(404).json({ 
        success: false, 
        message: "Address not found"
      });
    }

    console.log("🔍 Address found: ✅ YES");

    // ✅ احضر الكارت بتاع المستخدم
    const cart = await cartModel.findOne({ userId: userId.toString() });
    
    console.log("🛒 Cart Debug:");
    console.log("Cart found:", !!cart);
    console.log("Cart items:", cart?.items);
    
    if (!cart) {
      return res.status(400).json({ 
        success: false, 
        message: "Cart not found" 
      });
    }

    if (!cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Your cart is empty" 
      });
    }

    // ✅ احضر تفاصيل المنتجات من الداتابيس
    const orderItems = await Promise.all(
      cart.items.map(async (item) => {
        console.log("🔍 Looking for product:", item.productId);
        
        let product;
        
        // ✅ دور بطرق مختلفة
        if (mongoose.Types.ObjectId.isValid(item.productId)) {
          product = await productModel.findById(item.productId);
        }
        
        if (!product) {
          product = await productModel.findOne({ 
            $or: [
              { id: item.productId },
              { slug: item.productId },
              { sku: item.productId }
            ]
          });
        }
        
        if (!product) {
          console.error(`❌ Product not found: ${item.productId}`);
          throw new Error(`Product ${item.productId} not found`);
        }
        
        console.log("✅ Product found:", product.name, "storeId:", product.storeId);
        
        // ✅ تأكد إن المنتج عنده storeId
        if (!product.storeId) {
          throw new Error(`Product ${product.name} doesn't have a storeId`);
        }
        
        return {
          productId: product._id, // ✅ استخدم ObjectId الصحيح
          quantity: item.quantity,
          price: product.price,
          selectedColor: item.selectedColor || null,
          selectedSize: item.selectedSize || null, // ✅ إضافة المقاس المحدد
          storeId: product.storeId // ✅ احفظ storeId للتحقق
        };
      })
    );

    // ✅ تحقق إن كل المنتجات من نفس الـ store
    const storeIds = [...new Set(orderItems.map(item => item.storeId.toString()))];
    
    if (storeIds.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot create order with products from multiple stores. Please checkout one store at a time."
      });
    }
    
    const storeId = orderItems[0].storeId;

    // ✅ احسب إجمالي السعر
    const total = orderItems.reduce((acc, item) => {
      return acc + (item.price || 0) * (item.quantity || 0);
    }, 0);

    console.log("💰 Total Price:", total);
    console.log("🏪 Store ID:", storeId);

    // ✅ معالجة الكوبون (لو موجود)
    let couponData = {};
    let isCouponUsed = false;
    
    if (couponCode) {
      // ✅ دور على الكوبون في الداتابيس
      const coupon = await couponModel.findOne({ code: couponCode, isActive: true });
      
      if (coupon) {
        // يمكنك تطبيق خصم هنا
        isCouponUsed = true;
        couponData = {
          code: coupon.code,
          discount: coupon.discount
        };
        console.log("🎟️ Coupon applied:", couponCode);
      } else {
        console.log("⚠️ Invalid or inactive coupon:", couponCode);
      }
    }

    // ✅ أنشئ الأوردر مع كل الـ fields المطلوبة
    const newOrder = await orderModel.create({
      id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36), // ✅ Generate unique ID
      userId, // ✅ ObjectId
      storeId, // ✅ ObjectId من المنتج
      addressId, // ✅ ObjectId
      paymentMethod, // ✅ CASH أو VISA
      total, // ✅ مطلوب
      isCouponUsed, // ✅ Boolean
      coupon: couponData, // ✅ Object
      orderItems: orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize
      })), // ✅ بدون storeId في orderItems
      status: "ORDER_PLACED", // ✅ default value
      isPaid: paymentMethod === "VISA" ? false : false // يمكنك تعديله حسب منطق الدفع
    });

    console.log("✅ Order created successfully:", newOrder._id);

    // ✅ فضي الكارت بعد إنشاء الأوردر
    cart.items = [];
    await cart.save();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        id: newOrder.id,
        total: newOrder.total,
        status: newOrder.status,
        paymentMethod: newOrder.paymentMethod,
        isPaid: newOrder.isPaid,
        isCouponUsed: newOrder.isCouponUsed,
        coupon: newOrder.coupon,
        createdAt: newOrder.createdAt,
      },
    });  
  } catch (error) {
    console.error("❌ Error creating order:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};



// ✅ GET USER ORDERS (مع الألوان)
export const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user._id.toString();
    const skip = (page - 1) * limit;

    const query = { userId };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .populate('storeId', 'id name username logo')
        .populate('addressId', 'street city state country phone')
        .populate('orderItems.productId', 'id name images colors') // ← إضافة colors و sizes
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
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            colors: item.productId.colors // ← الألوان المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
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
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching orders'
    });
  }
};


// ✅ GET ORDER BY ID (مع الألوان)
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
      .populate('orderItems.productId', 'id name images colors sizes'); // ← إضافة colors و sizes

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
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            colors: item.productId.colors, // ← الألوان المتاحة
            sizes: item.productId.sizes // ← المقاسات المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor, // ← اللون المختار
          selectedSize: item.selectedSize // ← المقاس المختار
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


// ✅ GET STORE ORDERS (مع الألوان)
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

    const storeId = store._id.toString();
    const skip = (page - 1) * limit;

    const query = { storeId: storeId.toString() };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      orderModel.find(query)
        .populate('userId', 'id name email phone')
        .populate('addressId', 'street city state country phone')
        .populate('orderItems.productId', 'id name images price colors sizes') // ← إضافة colors و sizes
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

        customer: order.userId,
        address: order.addressId,

        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            price: item.productId.price,
            colors: item.productId.colors, // ← الألوان المتاحة
            sizes: item.productId.sizes // ← المقاسات المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor, // ← اللون المختار
          selectedSize: item.selectedSize // ← المقاس المختار
        }))
      })),

      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      },

      stats: {
        totalOrders: total,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        completedOrders: orders.filter(o => o.status === 'completed').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length
      }
    });

  } catch (error) {
    console.error('❌ Get store orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching store orders'
    });
  }
};


// ✅ UPDATE ORDER STATUS
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

    const validStatuses = ["ORDER_PLACED", "PROCESSING", "SHIPPED", "DELIVERED"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }

    const userId = req.user.id;
    const store = await storeModel.findOne({ userId });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a store'
      });
    }

    const storeId = store._id.toString();

    const order = await orderModel.findOne({ 
      id: orderId,
      storeId: storeId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to your store'
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update status of cancelled order'
      });
    }

    if (order.status === 'delivered' && status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of delivered order'
      });
    }

    order.status = status;
    
    if (status === 'delivered' && order.paymentMethod === 'cash') {
      order.isPaid = true;
    }

    await order.save();

    const updatedOrder = await orderModel.findOne({ id: orderId })
      .populate('userId', 'id name email phone')
      .populate('addressId', 'street city state country phone')
      .populate('orderItems.productId', 'id name images price colors sizes'); // ← إضافة colors و sizes

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        isPaid: updatedOrder.isPaid,
        total: updatedOrder.total,
        paymentMethod: updatedOrder.paymentMethod,
        createdAt: updatedOrder.createdAt,
        customer: updatedOrder.userId,
        address: updatedOrder.addressId,
        orderItems: updatedOrder.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            price: item.productId.price,
            colors: item.productId.colors, // ← الألوان المتاحة
            sizes: item.productId.sizes // ← المقاسات المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor, // ← اللون المختار
          selectedSize: item.selectedSize // ← المقاس المختار
        }))
      }
    });

  } catch (error) {
    console.error('❌ Update order status error:', error);
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
      .populate('orderItems.productId', 'id name images colors sizes'); // ← إضافة colors و sizes

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
          logo: order.storeId.logo,
          contact: order.storeId.contact
        },

        deliveryAddress: order.addressId,

        orderItems: order.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            colors: item.productId.colors // ← الألوان المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
        })),

        steps: order.status === 'cancelled' ? [trackingSteps[0], cancelledStep] : trackingSteps,
        
        estimatedDelivery: order.status === 'shipped' 
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          : null
      }
    });

  } catch (error) {
    console.error('❌ Get order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching order tracking'
    });
  }
};


const toStr = v => (v ? v.toString() : v);

// ✅ GET MY ORDERS (مع الألوان)
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user._id.toString();

    const query = { userId };
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
      productModel.find({ _id: { $in: productIds } }).lean() // ← جلب المنتجات مع colors و sizes
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
            sizes: product.sizes // ← المقاسات المتاحة
          } : null,
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor, // ← اللون المختار
          selectedSize: item.selectedSize // ← المقاس المختار
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
      { status: "processing", label: "Processing", completed: ["processing", "shipped", "delivered"].includes(order.status), timestamp: (["processing","shipped","delivered"].includes(order.status) ? order.updatedAt : null) },
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


// ✅ GET INVOICES
export const getInvoices = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      orderModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      orderModel.countDocuments({ userId })
    ]);

    const invoices = orders.map(order => {
      const subtotal = order.orderItems.reduce((s, it) => s + (it.price * it.quantity), 0);
      const taxRate = 0;
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      const total = order.total;
      return {
        invoiceNumber: `INV-${order.id}`,
        orderId: order.id,
        createdAt: order.createdAt,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: order.status
      };
    });

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      invoices
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ success: false, message: "Something went wrong while fetching invoices" });
  }
};


// ✅ GET INVOICE BY ID (مع الألوان)
export const getInvoiceById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    const order = await orderModel.findOne({ id: orderId }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (toStr(order.userId) !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You do not have permission to view this invoice" });
    }

    const store = order.storeId ? await storeModel.findById(order.storeId).lean() : null;
    const address = order.addressId ? await addressModel.findById(order.addressId).lean() : null;
    const products = await productModel.find({ _id: { $in: order.orderItems.map(i => i.productId) } }).lean();
    const productMap = {};
    products.forEach(p => (productMap[p._id.toString()] = p));

    const items = order.orderItems.map(it => {
      const product = productMap[it.productId.toString()];
      return {
        productId: it.productId,
        name: (product && product.name) || "Product",
        selectedColor: it.selectedColor || null, // ← اللون المختار
        selectedSize: it.selectedSize || null, // ← المقاس المختار
        availableColors: (product && product.colors) || [], // ← الألوان المتاحة
        availableSizes: (product && product.sizes) || [], // ← المقاسات المتاحة
        quantity: it.quantity,
        unitPrice: it.price,
        lineTotal: it.price * it.quantity
      };
    });

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const taxRate = 0;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = order.total;

    const invoice = {
      invoiceNumber: `INV-${order.id}`,
      orderId: order.id,
      createdAt: order.createdAt,
      seller: {
        name: store ? store.name : "Marketplace",
        email: store ? store.email : null,
        address: store ? store.address : null
      },
      buyer: {
        id: order.userId
      },
      billingAddress: address || null,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status: order.status
    };

    res.json({ success: true, invoice });

  } catch (error) {
    console.error("Get invoice by id error:", error);
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
    const storeId = req.user?.storeId || req.query.storeId;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // 🧮 عدد الطلبات
    const totalOrders = await orderModel.countDocuments({ storeId: storeObjectId });

    // 💰 الأرباح الكلية
    const totalRevenue = await calculateTotalRevenue({ storeId: storeObjectId });

    // 📦 عدد المنتجات
    const totalProducts = await productModel.countDocuments({ storeId: storeObjectId });

    // 🏆 أكثر منتج مبيعًا
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

    // 📊 مبيعات شهرية
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

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        totalProducts,
        topProduct: topProduct[0] || null,
        monthlySales,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching store dashboard", error: err.message });
  }
};

// ===================================================
// 🧭 ADMIN DASHBOARD
// ===================================================
export const getAdminDashboard = async (req, res) => {
  try {
    // 🏬 عدد المتاجر
    const totalStores = await storeModel.countDocuments();

    // 👥 عدد المستخدمين
    const totalUsers = await userModel.countDocuments({ role: "user" });

    // 💸 الأرباح العامة (من جميع الطلبات)
    const totalRevenue = await calculateTotalRevenue();

    // 🧾 عدد الطلبات الكلية
    const totalOrders = await orderModel.countDocuments();

    // 💰 مقارنة أرباح المتاجر
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

    // 🏆 أعلى متجر مبيعًا
    const topStore = storeRevenues[0] || null;

    // 📈 معدل النمو الشهري في المبيعات
    const monthlyRevenue = await orderModel.aggregate([
      { $match: { status: { $in: ["DELIVERED", "SHIPPED", "PROCESSING", "ORDER_PLACED"] } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$total" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalStores,
        totalUsers,
        totalOrders,
        totalRevenue,
        storeRevenues,
        topStore,
        monthlyRevenue,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching admin dashboard", error: err.message });
  }
};