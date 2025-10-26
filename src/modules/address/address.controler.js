import addressModel from '../../../DB/models/address.model.js';

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
