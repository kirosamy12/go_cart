import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercentage: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const couponModel = mongoose.model("Coupon", couponSchema);
export default couponModel;