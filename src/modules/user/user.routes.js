import express from "express";
import { 
  addUser, 
  changePassword, 
  deleteUserById, 
  getAllUsers, 
  getUserById, 
  updateUserById,
  updatePersonalInfo,
  forgotPassword,
  resetPassword
} from "./user.controler.js";
import { protectRoutes } from "../Auth/auth.controler.js";

const router= express.Router();

router.post("/addUser",addUser)
// router.get("/getAllUsers",protectRoutes,getAllUsers)
// router.get("/getUserById/:id",getUserById)
// router.patch("/updateUserById/:id",updateUserById)
// router.patch("/changePassword/:id",changePassword)
// router.delete("/deleteUserById/:id",deleteUserById)

// ✅ Protected routes for personal information and password management
router.patch("/updatePersonalInfo", protectRoutes, updatePersonalInfo);
router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);

export default router