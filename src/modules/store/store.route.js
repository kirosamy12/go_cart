import express from "express";
import { createStore, getAllStores, getStoreByUsername,updateStoreStatus,getPendingStores ,getAllUsers,getUserById,updateUserRole} from "../store/store.controler.js";
import { allowTo, protectRoutes } from "../Auth/auth.controler.js";
import { uploadSingle } from "../../utils/fileUploud.js";
const authRouter= express.Router();


authRouter.post("/createStore",protectRoutes,uploadSingle("logo"),createStore)
authRouter.get("/getAllStores",getAllStores)
authRouter.get("/store/:username",getStoreByUsername)
authRouter.put('/stores/:storeId/status', protectRoutes,allowTo("admin"), updateStoreStatus);
authRouter.get('/admin/stores/pending', protectRoutes,allowTo("admin"),getPendingStores);
authRouter.get("/admin/getAllUsers", protectRoutes,allowTo("admin"), getAllUsers);
authRouter.get("/admin/getUser/:id", protectRoutes,allowTo("admin"), getUserById);
authRouter.patch("/updateUserRole/:id", protectRoutes,allowTo("admin"), updateUserRole);
  
export default authRouter; 