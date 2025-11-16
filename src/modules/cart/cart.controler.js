// controllers/cart.controller.js
import cartModel from "../../../DB/models/cart.model.js";
import productModel from "../../../DB/models/products.model.js";
import mongoose from "mongoose";

// 🟢 Create Cart
export const createCart = async (req, res) => {
  try {
    const userId = req.user._id;
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

// 🟢 Get Cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await cartModel.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    res.status(200).json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 🟢 Update Entire Cart
export const updateCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items must be a non-empty array' });
    }

    for (const item of items) {
      if (
        typeof item.productId !== 'string' ||
        !item.productId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res.status(400).json({ success: false, message: 'Invalid item format' });
      }

      const productExists = await productModel.findOne({ id: item.productId });
      if (!productExists) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      }

      if (item.selectedColor && typeof item.selectedColor !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid color format' });
      }
      
      if (item.selectedSize && typeof item.selectedSize !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid size format' });
      }
      
      if (item.selectedScent && typeof item.selectedScent !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid scent format' });
      }
    }

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

// 🟢 Add or Update Single Item in Cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity, selectedColor, selectedSize, selectedScent } = req.body;

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
        items: [{ productId, quantity, selectedColor, selectedSize, selectedScent }]
      });
      return res.status(201).json({ success: true, cart });
    }

    // ✅ لو نفس المنتج ونفس اللون والمقاس والرائحة موجودين بالفعل، زوّد الكمية
    const existingItem = cart.items.find(
      item => item.productId === productId && 
              item.selectedColor === selectedColor && 
              item.selectedSize === selectedSize &&
              item.selectedScent === selectedScent
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, selectedColor, selectedSize, selectedScent });
    }

    await cart.save();
    res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error('❌ Error in addToCart:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 🟢 Remove Single Item from Cart
export const removeItemFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, color, size, scent } = req.params;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }

    const cart = await cartModel.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Filter items based on what parameters were provided
    const originalLength = cart.items.length;
    
    if (color && size && scent) {
      // Remove specific item with color, size, and scent
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedColor === color && 
                  item.selectedSize === size &&
                  item.selectedScent === scent)
      );
    } else if (color && size) {
      // Remove items with specific color and size (no scent specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedColor === color && 
                  item.selectedSize === size)
      );
    } else if (color && scent) {
      // Remove items with specific color and scent (no size specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedColor === color && 
                  item.selectedScent === scent)
      );
    } else if (size && scent) {
      // Remove items with specific size and scent (no color specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedSize === size && 
                  item.selectedScent === scent)
      );
    } else if (color) {
      // Remove items with specific color (no size or scent specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedColor === color)
      );
    } else if (size) {
      // Remove items with specific size (no color or scent specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedSize === size)
      );
    } else if (scent) {
      // Remove items with specific scent (no color or size specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId && 
                  item.selectedScent === scent)
      );
    } else {
      // Remove all items with this productId (no color/size/scent specified)
      cart.items = cart.items.filter(
        item => !(item.productId === productId)
      );
    }

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
