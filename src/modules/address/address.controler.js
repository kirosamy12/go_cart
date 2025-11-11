import addressModel from '../../../DB/models/address.model.js';
import shippingCostModel from '../../../DB/models/shippingCost.model.js';

// 🔸 Create Address
export const createAddress = async (req, res) => {
  try {
    // ✅ استخدم id من الـ token (هو اللي المشروع كله ماشي عليه)
    const userId = req.user.id;

    console.log("📝 Creating address for userId:", userId);

    const { name, email, street, city, state, zip, country, phone } = req.body;

    if (!name || !street || !city || !state || !zip || !country || !phone) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const newAddress = await addressModel.create({
      userId, // ✅ string من التوكن
      name,
      email,
      street,
      city,
      state,
      zip,
      country,
      phone,
    });

    res.status(201).json({
      success: true,
      address: newAddress,
    });
  } catch (err) {
    console.error("Create Address Error:", err);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};

// 🔸 Get all addresses for the current user
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ نفس id من التوكن

    console.log("📦 Fetching addresses for userId:", userId);

    const addresses = await addressModel.find({ userId });

    res.status(200).json({ success: true, addresses });
  } catch (err) {
    console.error("Get Addresses Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: err.message,
    });
  }
};


// 🔸 Delete address (only if belongs to user)
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const address = await addressModel.findOne({ id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await addressModel.deleteOne({ id: addressId });

    res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
};

// 🔸 Update address
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const address = await addressModel.findOne({ id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const updateFields = req.body;

    const updatedAddress = await addressModel.findOneAndUpdate(
      { id: addressId, userId },
      updateFields,
      { new: true }
    );

    res.status(200).json({ success: true, address: updatedAddress });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
};

// 🔸 Get shipping cost for a specific governorate
export const getShippingCost = async (req, res) => {
  try {
    const { governorate } = req.params;
    
    if (!governorate) {
      return res.status(400).json({
        success: false,
        message: "Governorate is required"
      });
    }

    const shippingCost = await shippingCostModel.findOne({ 
      governorate: governorate,
      isActive: true 
    });

    if (!shippingCost) {
      return res.status(404).json({
        success: false,
        message: "Shipping cost not found for this governorate"
      });
    }

    res.status(200).json({
      success: true,
      shippingCost: shippingCost.shippingCost
    });
  } catch (err) {
    console.error("Get Shipping Cost Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shipping cost",
      error: err.message,
    });
  }
};

// 🔸 Get all shipping costs (for admin)
export const getAllShippingCosts = async (req, res) => {
  try {
    const shippingCosts = await shippingCostModel.find({});

    res.status(200).json({
      success: true,
      shippingCosts
    });
  } catch (err) {
    console.error("Get All Shipping Costs Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shipping costs",
      error: err.message,
    });
  }
};

// 🔸 Update shipping cost (for admin)
export const updateShippingCost = async (req, res) => {
  try {
    const { governorate, shippingCost, isActive } = req.body;

    if (!governorate || shippingCost === undefined) {
      return res.status(400).json({
        success: false,
        message: "Governorate and shipping cost are required"
      });
    }

    const updatedShippingCost = await shippingCostModel.findOneAndUpdate(
      { governorate: governorate },
      { 
        governorate,
        shippingCost,
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Shipping cost updated successfully",
      shippingCost: updatedShippingCost
    });
  } catch (err) {
    console.error("Update Shipping Cost Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update shipping cost",
      error: err.message,
    });
  }
};