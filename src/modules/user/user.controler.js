import slugify from "slugify";
import { handleError } from "../../middleware/handleError.js";
import ApiFeatures from "../../utils/apiFeature.js";
import userModel from "../../../DB/models/user.model.js"
import { AppError } from "../../utils/appError.js";
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import sendEmail from '../../utils/sendEmail.js';

export const addUser =handleError( async (req,res,next)=>{

  let user = await userModel.findOne({email:req.body.email});
   if(user) return next (new AppError("email is already use",409))
    let addUser= new userModel(req.body)
const added = await addUser.save()
res.json({message:"done",added})
})


export const getAllUsers= handleError(async(req,res,next)=>{
    let apiFeature= new ApiFeatures(userModel.find(),req.query).pagination().sort().search().filter().fields()
    let result = await apiFeature.mongooseQuery;
    res.json({message:"done",result})
})
 
 

export const getUserById=handleError( async(req,res,next)=>{
   
    const getUserById=await userModel.findById( req.params.id)
        res.json({message:"done",getUserById})
    
});




 export const updateUserById = handleError(async (req, res, next) => {
    const { email, phoneNumber, ...otherFields } = req.body;
  
    if (email) {
      const existingEmail = await userModel.findOne({ email });
      if (existingEmail && existingEmail._id.toString() !== req.params.id) {
        return res.status(400).json({ message: "Email is already in use by another user" });
      }
    }
  
    if (phoneNumber) {
      const existingPhoneNumber = await userModel.findOne({ phoneNumber });
      if (existingPhoneNumber && existingPhoneNumber._id.toString() !== req.params.id) {
        return res.status(400).json({ message: "Phone number is already in use by another user" });
      }
    }
  
    const updatedUser = await userModel.findByIdAndUpdate(
      req.params.id,
      { ...otherFields, ...(email && { email }), ...(phoneNumber && { phoneNumber }) },
      { new: true }
    );
  
    if (updatedUser) {
      res.json({ message: "User updated successfully", updatedUser });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  });
  

// ✅ Update Personal Information (Protected Route)
export const updatePersonalInfo = handleError(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, email, phone } = req.body;

    // Validation
    if (!name && !email && !phone) {
      return res.status(400).json({
        success: false,
        message: "At least one field (name, email, or phone) is required"
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingEmail = await userModel.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use by another user"
        });
      }
    }

    // Update user information
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { 
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone })
      },
      { new: true, select: '-password' } // Exclude password from response
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Personal information updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        image: updatedUser.image
      }
    });
  } catch (error) {
    console.error("Update personal info error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while updating personal information"
    });
  }
});


  export const changePassword = handleError(async (req, res, next) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;
  
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new passwords are required" });
    }
  
    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }
  
    const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  
    user.password = hashedPassword;
    user.changePasswordAt = Date.now();
    await user.save();
  
    res.json({ message: "Password updated successfully" });
  });

// ✅ Forgot Password - Send OTP
export const forgotPassword = handleError(async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Check if user exists
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email"
      });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Save OTP to user document with expiration (10 minutes)
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    await userModel.findByIdAndUpdate(user._id, {
      passwordResetOtp: otp,
      passwordResetExpires: otpExpires
    });

    // Send OTP via email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset OTP",
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You have requested to reset your password. Please use the following OTP to reset your password:</p>
          <h3 style="color: #007bff; letter-spacing: 5px; font-size: 24px;">${otp}</h3>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      });

      res.json({
        success: true,
        message: "OTP sent to your email"
      });
    } catch (emailError) {
      console.error("❌ Error sending OTP email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later."
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while processing your request"
    });
  }
});

// ✅ Verify OTP and Reset Password
export const resetPassword = handleError(async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validation
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required"
      });
    }

    // Check if password meets requirements
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Find user with valid OTP
    const user = await userModel.findOne({
      email,
      passwordResetOtp: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or OTP has expired"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear OTP fields
    user.password = hashedPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetExpires = undefined;
    user.changePasswordAt = Date.now();
    
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while resetting your password"
    });
  }
});

// ✅ Delete User By ID
export const deleteUserById = handleError(async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await userModel.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while deleting user"
    });
  }
});