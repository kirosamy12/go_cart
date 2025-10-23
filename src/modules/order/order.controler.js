import storeModel from"../../../DB/models/store.model.js"
import addressModel from"../../../DB/models/address.model.js"
import productModel from"../../../DB/models/products.model.js"
import orderModel from "../../../DB/models/orderModel.js";
import cartModel from "../../../DB/models/cart.model.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;


const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// ✅ CREATE ORDER (مع دعم الألوان)
export const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    const userId = req.user._id.toString();

    // 1. التحقق من البيانات الأساسية
    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Address ID and payment method are required'
      });
    }

    // 2. التحقق من وجود العنوان
    const address = await addressModel.findOne({
      _id: new mongoose.Types.ObjectId(addressId),
      userId: req.user._id.toString()
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // 3. جلب محتوى السلة
    const cart = await cartModel.findOne({ userId });
    if (!cart || !cart.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // 4. تقسيم السلة حسب storeId
    const storeGroups = {};

    for (const item of cart.items) {
      const product = await productModel.findOne({ id: item.productId, inStock: true });
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found or out of stock`
        });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0'
        });
      }

      // ✅ التحقق من اللون إذا كان المنتج يحتوي على ألوان
      if (item.selectedColor) {
        if (!product.colors || product.colors.length === 0) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.name} does not have color options`
          });
        }
        
        if (!product.colors.includes(item.selectedColor)) {
          return res.status(400).json({
            success: false,
            message: `Color ${item.selectedColor} is not available for ${product.name}`
          });
        }
      }

      const storeId = product.storeId.toString();
      if (!storeGroups[storeId]) storeGroups[storeId] = [];

      storeGroups[storeId].push({ 
        product, 
        quantity: item.quantity,
        selectedColor: item.selectedColor || null // ← حفظ اللون المختار
      });
    }

    // 5. إنشاء الطلبات
    const createdOrders = [];

    for (const storeId of Object.keys(storeGroups)) {
      const storeItems = storeGroups[storeId];
      let total = 0;
      const validatedItems = [];

      for (const { product, quantity, selectedColor } of storeItems) {
        const itemTotal = product.price * quantity;
        total += itemTotal;

        validatedItems.push({
          productId: product._id,
          quantity,
          price: product.price,
          selectedColor // ← إضافة اللون المختار
        });
      }

      // 6. تطبيق الكوبون (اختياري)
      let coupon = {};
      let isCouponUsed = false;

      if (couponCode) {
        const couponDoc = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isPublic: true,
          expiresAt: { $gt: new Date() }
        });

        if (couponDoc) {
          const isNewUser = !(await orderModel.findOne({ userId }));
          const isMember = true;

          if (
            (couponDoc.forNewUser && isNewUser) ||
            (couponDoc.forMember && isMember) ||
            (!couponDoc.forNewUser && !couponDoc.forMember)
          ) {
            const discount = (total * couponDoc.discount) / 100;
            total = Math.max(0, total - discount);
            coupon = {
              code: couponDoc.code,
              discount: couponDoc.discount,
              discountAmount: discount
            };
            isCouponUsed = true;
          }
        }
      }

      // 7. إنشاء الطلب
      const order = new orderModel({
        id: generateId(),
        total,
        userId,
        storeId,
        addressId,
        paymentMethod,
        isCouponUsed,
        coupon,
        orderItems: validatedItems
      });

      await order.save();

      // 8. populate
      const populatedOrder = await orderModel.findOne({ id: order.id })
        .populate('userId', 'id name email')
        .populate('storeId', 'id name username')
        .populate('addressId', 'id street city country phone')
        .populate('orderItems.productId', 'id name images colors'); // ← إضافة colors

      createdOrders.push({
        id: populatedOrder.id,
        total: populatedOrder.total,
        status: populatedOrder.status,
        paymentMethod: populatedOrder.paymentMethod,
        isPaid: populatedOrder.isPaid,
        isCouponUsed: populatedOrder.isCouponUsed,
        coupon: populatedOrder.coupon,
        createdAt: populatedOrder.createdAt,
        orderItems: populatedOrder.orderItems.map(item => ({
          product: {
            id: item.productId.id,
            name: item.productId.name,
            images: item.productId.images,
            colors: item.productId.colors // ← إرجاع الألوان المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
        })),
        user: populatedOrder.userId,
        store: populatedOrder.storeId,
        address: populatedOrder.addressId
      });
    }

    // 9. إفراغ السلة
    cart.items = [];
    await cart.save();

    // 10. إرسال الرد النهائي
    res.status(201).json({
      success: true,
      message: `Created ${createdOrders.length} order(s)`,
      orders: createdOrders
    });

  } catch (error) {
    console.error('❌ Error in createOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while creating orders'
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
        .populate('orderItems.productId', 'id name images colors') // ← إضافة colors
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
      .populate('orderItems.productId', 'id name images colors'); // ← إضافة colors

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
            colors: item.productId.colors // ← الألوان المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
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
        .populate('orderItems.productId', 'id name images price colors') // ← إضافة colors
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
      .populate('orderItems.productId', 'id name images price colors'); // ← إضافة colors

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
            colors: item.productId.colors // ← الألوان المتاحة
          },
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
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
      .populate('orderItems.productId', 'id name images colors'); // ← إضافة colors

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
      productModel.find({ _id: { $in: productIds } }).lean() // ← جلب المنتجات مع colors
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
            colors: product.colors // ← الألوان المتاحة
          } : null,
          quantity: item.quantity,
          price: item.price,
          selectedColor: item.selectedColor // ← اللون المختار
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
              colors: product.colors // ← الألوان المتاحة
            } : { id: i.productId },
            quantity: i.quantity,
            price: i.price,
            selectedColor: i.selectedColor // ← اللون المختار
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
        availableColors: (product && product.colors) || [], // ← الألوان المتاحة
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