// DB/models/review.model.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' }
}, {
  timestamps: true
});

const reviewModel = mongoose.model("Review", reviewSchema);
export default reviewModel;
