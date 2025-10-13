import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  userId: {
    type: String, // ✅ خليه String بدل ObjectId
    required: true
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zip: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});


export default mongoose.model('Address', addressSchema);
