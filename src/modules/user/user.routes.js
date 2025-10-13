import express from "express";
import { addUser, changePassword, deleteUserById, getAllUsers, getUserById, updateUserById } from "./user.controler.js";
import { validation } from "../../middleware/validation.js";
import { protectRoutes } from "../Auth/auth.controler.js";


const router= express.Router();



router.post("/addUser",addUser)
// router.get("/getAllUsers",protectRoutes,getAllUsers)
// router.get("/getUserById/:id",getUserById)
// router.patch("/updateUserById/:id",updateUserById)
// router.patch("/changePassword/:id",changePassword)
// router.delete("/deleteUserById/:id",deleteUserById)

export default router     