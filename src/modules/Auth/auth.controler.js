import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../../../DB/models/user.model.js";
import { handleError } from "../../middleware/handleError.js";
import storeModel from "../../../DB/models/store.model.js";
import passport, { initGoogleAuth } from "./googleAuth.js"; // Import the init function

// Initialize Google OAuth strategy
initGoogleAuth();

// Generate unique ID
const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// 1. USER REGISTRATION
export const register = handleError(async (req, res) => {
  try {
    const { name, email, password, image } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Name, email, and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "User already exists with this email",
      });
    }

    // Hash password
    const saltRounds = 6;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new userModel({
      id: generateId(),
      name,
      email,
      password: hashedPassword, // ✨ تخزين الباسورد بعد التشفير
      image: image || "",
      cart: {},
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      "kiro", // ✨ لازم تحطها في ENV file
      { expiresIn: "24h" }
    );

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong during registration",
    });
  }
});



// 2. USER LOGIN
export const login = async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Email and password are required",
    });
  }

  // Find user
  const user = await userModel.findOne({ email });
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid credentials",
    });
  }

  // Verify password (skip for Google auth users)
  if (user.password) {
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid credentials",
      });
    }
  }

  // Generate JWT token
  // For store users, include storeId in the token
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };
  
  // If user is a store owner, add storeId to token
  if (user.role === 'store') {
    const store = await storeModel.findOne({ userId: user.id });
    if (store) {
      tokenPayload.storeId = store.id;
    }
  }
  
  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || "kiro", // من الأفضل يكون في .env
    { expiresIn: "24h" }
  );

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    token,
  });
};
// 3. GET USER PROFILE
export const getProfile = handleError(async (req, res) => {
  try {
    // Expecting JWT in Authorization header (with or without "Bearer ")
    const authHeader = req.headers.token;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No token provided",
      });
    }

    // Handle "Bearer <token>" or just "<token>"
    let token;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      token = authHeader;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "kiro");
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid token",
      });
    }

    // Find user by id
    const user = await userModel.findOne({ id: decoded.userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        cart: user.cart,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while fetching profile",
    });
  }
});

export const protectRoutes = handleError(async (req, res, next) => {
  let { token } = req.headers;

  if (!token) {
    return res.status(400).json({
      status: "fail",
      message: "please provide token"
    });
  }

  let decoded;
  try {
    decoded = await jwt.verify(token, process.env.JWT_SECRET || "kiro");
  } catch (err) {
    return res.status(401).json({
      status: "fail",
      message: "invalid token payload"
    });
  }

  if (!decoded || (!decoded.id && !decoded.userId)) {
    return res.status(401).json({
      status: "fail",
      message: "invalid token payload"
    });
  }

  // Support both id and userId in token
  const userId = decoded.id || decoded.userId;
  let user = await userModel.findOne({ id: userId });

  if (!user) {
    return res.status(400).json({
      status: "fail",
      message: "invalid user"
    });
  }

  if (user.changePasswordAt) {
    let changePasswordTime = parseInt(user.changePasswordAt.getTime() / 1000);
    if (changePasswordTime > decoded.iat) {
      return res.status(400).json({
        status: "fail",
        message: "token invalid"
      });
    }
  }
  // Add storeId to user object if available in token
  if (decoded.storeId) {
    user.storeId = decoded.storeId;
  }
  
  req.user = user;

  next();
});

export const allowTo = (...roles) => {
  return handleError((req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(401).json({
        status: "fail",
        message: "not authorized"
      });
    }
    next();
  });
};

export const isStoreOwner = async (req, res, next) => {
  const userId = req.user._id.toString();
  const store = await storeModel.findOne({ userId });
  
  if (!store) {
    return res.status(403).json({
      success: false,
      message: 'You do not have a store'
    });
  }
  
  req.store = store; // حفظ بيانات المتجر
  next();
};