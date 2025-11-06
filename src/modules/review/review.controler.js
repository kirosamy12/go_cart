// src/modules/review/review.controler.js
import reviewModel from "../../../DB/models/review.model.js";
import productModel from "../../../DB/models/products.model.js";
import userModel from "../../../DB/models/user.model.js";

// 🟢 Create Review
export const createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user._id;

    // Validation
    if (!productId || !rating) {
      return res.status(400).json({ 
        success: false, 
        message: "Product ID and rating are required" 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "Rating must be between 1 and 5" 
      });
    }

    // Check if product exists
    const product = await productModel.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await reviewModel.findOne({ userId, productId });
    if (existingReview) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already reviewed this product" 
      });
    }

    // Create review
    const newReview = await reviewModel.create({
      userId,
      productId,
      rating,
      comment: comment || ""
    });

    // Update product with new review
    await updateProductRating(productId);

    res.status(201).json({ 
      success: true, 
      message: "Review created successfully",
      review: newReview 
    });
  } catch (err) {
    console.error("❌ Error in createReview:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// 🟢 Get Reviews for Product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if product exists
    const product = await productModel.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      reviewModel.find({ productId })
        .populate('userId', 'id name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      reviewModel.countDocuments({ productId })
    ]);

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("❌ Error in getProductReviews:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// 🟢 Update Review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    // Validation
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ 
        success: false, 
        message: "Rating must be between 1 and 5" 
      });
    }

    // Find review
    const review = await reviewModel.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: "Review not found or you don't have permission to update it" 
      });
    }

    // Update review
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    
    await review.save();

    // Update product rating
    await updateProductRating(review.productId);

    res.status(200).json({ 
      success: true, 
      message: "Review updated successfully",
      review 
    });
  } catch (err) {
    console.error("❌ Error in updateReview:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// 🟢 Delete Review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    // Find review
    const review = await reviewModel.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: "Review not found or you don't have permission to delete it" 
      });
    }

    // Delete review
    await reviewModel.deleteOne({ _id: reviewId });

    // Update product rating
    await updateProductRating(review.productId);

    res.status(200).json({ 
      success: true, 
      message: "Review deleted successfully" 
    });
  } catch (err) {
    console.error("❌ Error in deleteReview:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// 🟢 Get User Reviews
export const getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      reviewModel.find({ userId })
        .populate('productId', 'id name images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      reviewModel.countDocuments({ userId })
    ]);

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("❌ Error in getUserReviews:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    const reviews = await reviewModel.find({ productId });
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;
      
      await productModel.updateOne(
        { id: productId },
        { 
          $set: { 
            rating: averageRating,
            reviewCount: reviews.length
          }
        }
      );
    } else {
      // If no reviews, reset rating
      await productModel.updateOne(
        { id: productId },
        { 
          $set: { 
            rating: 0,
            reviewCount: 0
          }
        }
      );
    }
  } catch (err) {
    console.error("❌ Error updating product rating:", err);
  }
};