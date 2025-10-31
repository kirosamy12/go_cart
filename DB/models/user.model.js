
import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true
  }, 
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  cart: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'store'], // Fixed typo: 'stote' -> 'store'
    default: 'user'
  }
}, {
  timestamps: true
});

 
const userModel= mongoose.model("User",userSchema)
export default userModel
