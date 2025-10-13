import multer from "multer";
import cloudinary from 'cloudinary';
const { v2: cloudinaryInstance } = cloudinary;
import { AppError } from "../utils/appError.js";

cloudinary.config({
  cloud_name: "dxvynre0v",
  api_key: "351626516951211",
  api_secret: "xN5iZjmsFAN0bGf528K1JsI3myk",
});

const storage = multer.diskStorage({});

// Create a custom multer instance that accepts array notation
const arrayFields = (fieldsConfig) => {
  return (req, res, next) => {
    const upload = multer({ storage }).fields([
      { name: "imageCover", maxCount: 1 },
      ...Array(10).fill().map((_, i) => ({ 
        name: `images[${i}]`, 
        maxCount: 1 
      }))
    ]);

    upload(req, res, async (err) => {
      if (err) return next(new AppError(err.message, 400));

      try {
        // Handle imageCover
        if (req.files.imageCover) {
          const coverUploadResult = await cloudinary.uploader.upload(
            req.files.imageCover[0].path
          );
          req.body.imageCover = coverUploadResult.secure_url;
        }

        // Handle array-style images
        const imageFiles = Object.entries(req.files)
          .filter(([key]) => key.startsWith('images['))
          .sort((a, b) => {
            const aIndex = parseInt(a[0].match(/\[(\d+)\]/)[1]);
            const bIndex = parseInt(b[0].match(/\[(\d+)\]/)[1]);
            return aIndex - bIndex;
          })
          .map(([_, files]) => files[0]);

        if (imageFiles.length > 0) {
          const imagesResults = await Promise.all(
            imageFiles.map(file => cloudinary.uploader.upload(file.path))
          );
          req.body.images = imagesResults.map(result => result.secure_url);
        }

        next();
      } catch (error) {
        next(new AppError("Error processing upload", 400));
      }
    });
  };
};

export const handleFileUpload = (uploadType, fieldName, fieldsConfig) => {
  if (uploadType === "fields") {
    return arrayFields(fieldsConfig);
  }

  const upload = multer({ storage });
  
  return async (req, res, next) => {
    try {
      const uploader = getUploader(upload, uploadType, fieldName);
      
      await uploader(req, res, async (err) => {
        if (err) return next(new AppError(err.message, 400));

        if (uploadType === "single" && req.file) {
          const uploadResult = await cloudinary.uploader.upload(req.file.path);
          req.body.image = uploadResult.secure_url;
        } else if (uploadType === "array" && req.files) {
          const uploadResults = await Promise.all(
            req.files.map((file) => cloudinary.uploader.upload(file.path))
          );
          req.body.images = uploadResults.map((result) => result.secure_url);
        } else {
          return next(new AppError("No valid files provided for upload.", 400));
        }
        
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

const getUploader = (upload, uploadType, fieldName) => {
  switch (uploadType) {
    case "single":
      return upload.single(fieldName);
    case "array":
      return upload.array(fieldName, 10);
    default:
      throw new AppError("Invalid upload type.", 400);
  }
};

export const uploadSingle = (fieldName) => handleFileUpload("single", fieldName);
export const uploadArray = (fieldName) => handleFileUpload("array", fieldName);
export const uploadFields = (fieldsConfig) => handleFileUpload("fields", null, fieldsConfig);