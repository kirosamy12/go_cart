// DB/models/analytics.model.js
import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  metric: { type: String, required: true }, // e.g., "sales", "users"
  value: { type: Number, required: true },
  date: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const analyticsModel = mongoose.model("Analytics", analyticsSchema);
export default analyticsModel;
