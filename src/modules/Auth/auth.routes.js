import express from "express";
import { register,login ,getProfile} from "./auth.controler.js";
const authRouter= express.Router();


// authRouter.get("/getUserProfile",protectRoutes,getUserProfile)
authRouter.post("/register",register)
 authRouter.post("/login",login)
// authRouter.get("/verify-email/:token", verifyEmail)
// authRouter.post("/forgotPassword",forgotPassword)
// authRouter.post("/resetPassword",resetPassword)

authRouter.get("/profile", getProfile);








export default authRouter; 