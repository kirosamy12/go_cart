// DB/models/payment.model.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: [ "Cash", "visa"], default: "Cash" },
  status: { type: String, enum: ["Pending", "Completed", "Failed"], default: "Pending" }
}, {
  timestamps: true
});

const paymentModel = mongoose.model("Payment", paymentSchema);
export default paymentModel;
