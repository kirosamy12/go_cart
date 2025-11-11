import multer from "multer";
import cloudinary from "cloudinary";
const { v2: cloudinaryInstance } = cloudinary;
import { AppError } from "../utils/appError.js";

// ✅ إعداد Cloudinary
cloudinary.config({
  cloud_name: "dxvynre0v",
  api_key: "351626516951211",
  api_secret: "xN5iZjmsFAN0bGf528K1JsI3myk",
});

// ✅ إعداد التخزين المؤقت
const storage = multer.diskStorage({});

// ✅ إنشاء instance من multer مع حدود حجم الملف
const createMulter = () =>
  multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB لكل ملف
  });

/* ===========================================================
   🖼️ دالة رفع صورة واحدة
   =========================================================== */
export const uploadSingle = (fieldName) => {
  const upload = createMulter();

  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) return next(new AppError(err.message, 400));
      if (!req.file) return next(new AppError("No file uploaded", 400));

      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "products",
          transformation: [{ quality: "auto:good", fetch_format: "auto" }],
        });

        req.body.image = result.secure_url;
        next();
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        next(new AppError("Error uploading image to Cloudinary", 500));
      }
    });
  };
};

/* ===========================================================
   🖼️ دالة رفع مجموعة صور (array)
   =========================================================== */
export const uploadArray = (fieldName) => {
  const upload = createMulter();

  return async (req, res, next) => {
    upload.array(fieldName, 10)(req, res, async (err) => {
      if (err) return next(new AppError(err.message, 400));
      if (!req.files || req.files.length === 0)
        return next(new AppError("No images provided", 400));

      try {
        const results = await Promise.all(
          req.files.map((file) =>
            cloudinary.uploader.upload(file.path, {
              folder: "products",
              transformation: [{ quality: "auto:good", fetch_format: "auto" }],
            })
          )
        );

        req.body.images = results.map((r) => r.secure_url);
        next();
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        next(new AppError("Error uploading images to Cloudinary", 500));
      }
    });
  };
};

/* ===========================================================
   🖼️ دالة رفع حقول متعددة (زي imageCover + images[])
   =========================================================== */
export const uploadFields = () => {
  const upload = createMulter();

  return async (req, res, next) => {
    upload.fields([
      { name: "imageCover", maxCount: 1 },
      { name: "images", maxCount: 10 },
    ])(req, res, async (err) => {
      if (err) return next(new AppError(err.message, 400));

      try {
        // رفع صورة الغلاف
        if (req.files.imageCover) {
          const cover = req.files.imageCover[0];
          const uploadCover = await cloudinary.uploader.upload(cover.path, {
            folder: "products",
            transformation: [{ quality: "auto:good", fetch_format: "auto" }],
          });
          req.body.imageCover = uploadCover.secure_url;
        }

        // رفع باقي الصور
        if (req.files.images && req.files.images.length > 0) {
          const results = await Promise.all(
            req.files.images.map((file) =>
              cloudinary.uploader.upload(file.path, {
                folder: "products",
                transformation: [
                  { quality: "auto:good", fetch_format: "auto" },
                ],
              })
            )
          );
          req.body.images = results.map((r) => r.secure_url);
        }

        next();
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        next(new AppError("Error uploading images to Cloudinary", 500));
      }
    });
  };
};
