// models/Cart.js
import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true
    }
    ,
    items: [
      {
        productId: {
          type: String, // 👈 مهم: String مش ObjectId
          required: true
        },
        quantity: {
          type: Number,
          default: 1
        },selectedColor: String
      }
    ]
  },
  {
    timestamps: true
  }
);

const cartModel = mongoose.model("Cart", cartSchema);
export default cartModel;
