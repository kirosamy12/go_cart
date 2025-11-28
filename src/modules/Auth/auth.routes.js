import express from "express";
import { register, login, getProfile } from "./auth.controler.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import userModel from "../../../DB/models/user.model.js";
import storeModel from "../../../DB/models/store.model.js";

const authRouter = express.Router();

// Traditional auth routes
authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/profile", getProfile);

// Google OAuth routes
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/api/auth/login" }),
  async (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const tokenPayload = {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role || "user"
      };

      // If user is a store owner, add storeId to token
      if (req.user.role === "store") {
        const store = await storeModel.findOne({ userId: req.user.id });
        if (store) {
          tokenPayload.storeId = store.id;
        }
      }

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || "kiro",
        { expiresIn: "24h" }
      );

      // Encode token to avoid breaking the URL in Next.js
      const encodedToken = encodeURIComponent(token);

      // Redirect to frontend safely
      return res.redirect(
        `https://shopverse-cart.vercel.app/auth/success?token=${encodedToken}`
      );

    } catch (error) {
      console.error("Google callback error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Something went wrong during Google authentication"
      });
    }
  }
);

export default authRouter;
