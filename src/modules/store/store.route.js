import express from "express";
import { createStore, getAllStores, getStoreByUsername,updateStoreStatus,getPendingStores ,getAllUsers,getUserById,updateUserRole, updateStore} from "../store/store.controler.js";
import { allowTo, protectRoutes } from "../Auth/auth.controler.js";
import { uploadSingle } from "../../utils/fileUploud.js";
const authRouter= express.Router();


authRouter.post("/createStore",protectRoutes,uploadSingle("logo"),createStore)
authRouter.get("/getAllStores",getAllStores)
authRouter.get("/:username",getStoreByUsername)
authRouter.put('/stores/:storeId/status', protectRoutes,allowTo("admin"), updateStoreStatus);
authRouter.get('/admin/stores/pending', protectRoutes,allowTo("admin"),getPendingStores);
authRouter.get("/admin/users", protectRoutes,allowTo("admin"), getAllUsers);
authRouter.get("/admin/getUser/:id", protectRoutes,allowTo("admin"), getUserById);
authRouter.put("/updateUserRole/:id", protectRoutes,allowTo("admin"), updateUserRole);
authRouter.put('/stores/update', protectRoutes, uploadSingle("logo"), updateStore);
  
export default authRouter;