import mongoose from "mongoose";
const storeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  logo: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});


  const storeModel = mongoose.model("Store", storeSchema);
  
  export default storeModel;