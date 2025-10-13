// DB/models/wishlist.model.js
import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  products: [{ type: String }]
}, {
  timestamps: true
});

const wishlistModel = mongoose.model("Wishlist", wishlistSchema);
export default wishlistModel;
