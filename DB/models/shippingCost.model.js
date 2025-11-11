import mongoose from 'mongoose';

const shippingCostSchema = new mongoose.Schema({
  governorate: {
    type: String,
    required: true,
    trim: true
  },
  shippingCost: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add index for better query performance
shippingCostSchema.index({ governorate: 1 });

const shippingCostModel = mongoose.model("ShippingCost", shippingCostSchema);
export default shippingCostModel;