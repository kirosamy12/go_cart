// models/Category.js

import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    image: {
      type: String // URL لصورة مثلاً
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true // ✅ يضيف createdAt و updatedAt تلقائيًا
  }
);

export default mongoose.model('Category', categorySchema);
