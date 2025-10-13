
import slugify from "slugify";
import { handleError } from "../../middleware/handleError.js";
import { deleteOne } from "../handlers/apiHander.js";
import ApiFeatures from "../../utils/apiFeature.js";
import userModel from "../../../DB/models/user.model.js"
import { AppError } from "../../utils/appError.js";
import bcrypt from 'bcrypt';

export const addUser =handleError( async (req,res,next)=>{

  let user = await userModel.findOne({email:req.body.email});
   if(user) return next (new AppError("email is already use",409))
    let addUser= new userModel(req.body)
const added = await addUser.save()
res.json({message:"done",added})
})


export const getAllUsers= handleError(async(req,res,next)=>{
    let apiFeature= new ApiFeatures(userModel.find(),req.query).pagination().sort().search().filter().fields()
    let result = await apiFeature.mongooseQuery;
    res.json({message:"done",result})
})
 
 

export const getUserById=handleError( async(req,res,next)=>{
   
    const getUserById=await userModel.findById( req.params.id)
        res.json({message:"done",getUserById})
    
});




 export const updateUserById = handleError(async (req, res, next) => {
    const { email, phoneNumber, ...otherFields } = req.body;
  
    if (email) {
      const existingEmail = await userModel.findOne({ email });
      if (existingEmail && existingEmail._id.toString() !== req.params.id) {
        return res.status(400).json({ message: "Email is already in use by another user" });
      }
    }
  
    if (phoneNumber) {
      const existingPhoneNumber = await userModel.findOne({ phoneNumber });
      if (existingPhoneNumber && existingPhoneNumber._id.toString() !== req.params.id) {
        return res.status(400).json({ message: "Phone number is already in use by another user" });
      }
    }
  
    const updatedUser = await userModel.findByIdAndUpdate(
      req.params.id,
      { ...otherFields, ...(email && { email }), ...(phoneNumber && { phoneNumber }) },
      { new: true }
    );
  
    if (updatedUser) {
      res.json({ message: "User updated successfully", updatedUser });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  });
  

 


  export const changePassword = handleError(async (req, res, next) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;
  
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new passwords are required" });
    }
  
    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }
  
    const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  
    user.password = hashedPassword;
    user.changePasswordAt = Date.now();
    await user.save();
  
    res.json({ message: "Password updated successfully" });
  });

export const forgotPassword = handleError(async (req,res,next)=>{
    const code = nanoid()
    await userModel.updateOne({email:req.body.email},{code})
    return res.json(code)
})

export const resetPassword = handleError(async(req,res,next)=>{
    const userExist = await userModel.findOne({email:req.body.email,code:req.body.code})
    if(!userExist){
        return next(new Error("user doesn't Exist or invalid code"))
    }
    const password = bcrypt.hashSync(req.body.password,+process.env.SALT_ROUND)
    await userModel.updateOne({email},{password})
    return res.status(200).json({message:"password successfully reset"})
})



export const deleteUserById= deleteOne(userModel)