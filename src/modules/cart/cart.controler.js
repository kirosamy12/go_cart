import cartModel from "../../../DB/models/cart.model.js";
import productModel from "../../../DB/models/products.model.js"
import mongoose from "mongoose";



export const createCart = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ من التوكن
    const { items } = req.body;

    const existing = await cartModel.findOne({ userId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Cart already exists' });
    }

    const newCart = await cartModel.create({ userId, items });
    res.status(201).json({ success: true, cart: newCart });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const getCart = async (req, res) => {
    try {
      const userId = req.user._id; // ✅ من التوكن
  
      const cart = await cartModel.findOne({ userId });
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      res.status(200).json({ success: true, cart });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };




  export const updateCart = async (req, res) => {
    try {
      const userId = req.user._id; // أو req.user.id حسب ما جايلك من middleware
      const { items } = req.body;
  
      // تحقق إن items مصفوفة
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Items must be a non-empty array' });
      }
  
      // تحقق من كل عنصر
      for (const item of items) {
        if (
          typeof item.productId !== 'string' ||
          !item.productId.trim() ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          return res.status(400).json({ success: false, message: 'Invalid item format' });
        }
  
        // تحقق من وجود المنتج (اختياري لكن مفيد)
        const productExists = await productModel.findOne({ id: item.productId });
        if (!productExists) {
          return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
        }
      }
  
      // تحديث السلة
      const updated = await cartModel.findOneAndUpdate(
        { userId },
        { items },
        { new: true }
      );
  
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      res.status(200).json({ success: true, cart: updated });
    } catch (err) {
      console.error('❌ Error in updateCart:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // 🟢 Add/Update Single Item in Cart (userId from token)


 
  export const addToCart = async (req, res) => {
    try {
      const userId = req.user._id;
      const { productId, quantity } = req.body;
  
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid productId format' });
      }
  
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid quantity' });
      }
  
      const product = await productModel.findOne({ id: productId });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      let cart = await cartModel.findOne({ userId });
  
      if (!cart) {
        cart = await cartModel.create({
          userId,
          items: [{ productId, quantity }]
        });
        return res.status(201).json({ success: true, cart });
      }
  
      const existingItem = cart.items.find(item => item.productId === productId);
  
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
  
      await cart.save();
      res.status(200).json({ success: true, cart });
  
    } catch (err) {
      console.error('❌ Error in addToCart:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };

  
  // 🟢 Delete Item from Cart
  export const removeItemFromCart = async (req, res) => {
    try {
      const userId = req.user._id;
      const { productId } = req.params;
  
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid productId' });
      }
  
      const cart = await cartModel.findOne({ userId });
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      const originalLength = cart.items.length;
      cart.items = cart.items.filter(item => item.productId !== productId);
  
      if (cart.items.length === originalLength) {
        return res.status(404).json({ success: false, message: 'Item not found in cart' });
      }
  
      await cart.save();
      res.status(200).json({ success: true, cart });
    } catch (err) {
      console.error('❌ Error in removeItemFromCart:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  
  // 🟢 Delete Entire Cart
  export const deleteCart = async (req, res) => {
    try {
      const userId = req.params.userId;
      const result = await cartModel.findOneAndDelete({ userId });
  
      if (!result) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      res.status(200).json({ success: true, message: 'Cart deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };