import { globalErrorHandler, handleError } from "./middleware/handleError.js"
import auth from "./modules/Auth/auth.routes.js";
import cartRouter from "./modules/cart/cart.routes.js";
import categoryRouter from "./modules/category/category.route.js";
import router from "./modules/order/order.routes.js";
import productRouter from "./modules/products/products.route.js";
import authRouter from "./modules/store/store.route.js";
import address from "./modules/address/address.route.js"




export const allRoutes=(app)=>{
    app.use("/api",categoryRouter)
   // app.use("/api/v1",subCategoryRouter)
   app.use("/api",authRouter)
    app.use("/api",productRouter)
  //  app.use("/api",userRouter)
    app.use("/api/auth",auth)
 //   app.use("/api/v1",wishListRouter)
 //   app.use("/api/v1",couponRouter)
app.use("/api",cartRouter)
    app.use("/api",router)
    app.use("/api",address)
  //  app.use("/api/v1",bannerRouter)









    // app.all('*', (req, res, next) => {
    //     next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
    //   });

      app.use(globalErrorHandler);
}  