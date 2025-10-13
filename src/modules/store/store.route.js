import express from "express";
import { createStore, getAllStores, getStoreByUsername } from "./store.controler.js";
import { protectRoutes } from "../Auth/auth.controler.js";
import { uploadSingle } from "../../utils/fileUploud.js";
const authRouter= express.Router();


authRouter.post("/createStore",protectRoutes,uploadSingle("logo"),createStore)
authRouter.get("/getAllStores",getAllStores)
authRouter.get("/:username",getStoreByUsername)




 
export default authRouter; 