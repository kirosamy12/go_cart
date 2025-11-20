import storeModel from "../../../DB/models/store.model.js";
import userModel from "../../../DB/models/user.model.js";
import sendEmail from "../../utils/sendEmail.js";
import productModel from "../../../DB/models/products.model.js";



const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};




// 1. CREATE STORE
export const createStore = async (req, res) => {
  try {
    const { name, username, description, email, contact, address } = req.body;
    const logo = req.body.image || ""; // ← تم جلب الصورة من cloudinary هنا
    const userId = req.user.id;

    // Validation
    if (!name || !username || !description || !email || !contact || !address) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "All required fields must be provided",
      });
    }
   
    // Check if user already has a store
    const existingStore = await storeModel.findOne({ userId });
    if (existingStore) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "User already has a store",
      });
    }

    // Check if username is already taken
    const usernameExists = await storeModel.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Username is already taken",
      });
    }

    // Check if email is already taken
    const emailExists = await storeModel.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Email is already taken by another store",
      });
    }

    // Create store
    const store = new storeModel({
      id: generateId(),
      userId,
      name,
      username,
      description,
      email,
      contact,
      address,
      logo,
      status: "pending",
      isActive: false,
    });

    await store.save();

    // ✅ Send email notification to all admins about new store request
    try {
      // Use findOne with the custom id field instead of findById
      const user = await userModel.findOne({ id: userId });
      // Get all admin users
      const adminUsers = await userModel.find({ role: 'admin' });
      
      console.log("📧 Attempting to send email to admins:", adminUsers.length);
      console.log("📧 Admin user emails:", adminUsers.map(admin => admin.email));
      console.log("📧 User info:", user?.name, user?.email);
      
      // Send email to all admins
      if (adminUsers && adminUsers.length > 0) {
        let emailsSent = 0;
        let emailErrors = [];
        
        for (const admin of adminUsers) {
          if (admin.email) {
            try {
              await sendEmail({
                to: admin.email,
                subject: "New Store Request - Pending Approval",
                html: `
                  <h2>New Store Request</h2>
                  <p>A new store request has been submitted and is pending approval.</p>
                  <p><strong>Store Details:</strong></p>
                  <ul>
                    <li>Store Name: ${name}</li>
                    <li>Username: ${username}</li>
                    <li>Description: ${description}</li>
                    <li>Email: ${email}</li>
                    <li>Contact: ${contact}</li>
                    <li>Address: ${address}</li>
                    <li>Submitted by: ${user?.name || 'N/A'} (${user?.email || 'N/A'})</li>
                    <li>Submission Date: ${new Date().toLocaleString()}</li>
                  </ul>
                  <p>Please review and approve/reject this request in the admin panel.</p>
                `
              });
              console.log(`📧 Admin notification email sent successfully to: ${admin.email}`);
              emailsSent++;
            } catch (adminEmailError) {
              console.error(`❌ Error sending email to admin ${admin.email}:`, adminEmailError);
              emailErrors.push({
                email: admin.email,
                error: adminEmailError.message
              });
            }
          }
        }
        console.log(`📧 Admin notification emails sent successfully to ${emailsSent} admin(s) for new store request`);
        
        // Log email errors if any occurred
        if (emailErrors.length > 0) {
          console.error("❌ Some admin notification emails failed to send:", emailErrors);
        }
      } else {
        console.log("📧 No admin users found to send notification to");
      }
      
      console.log("📧 Admin notification email process completed for new store request");
    } catch (emailError) {
      console.error("❌ Error sending admin notification email:", emailError);
      console.error("❌ Email error details:", {
        message: emailError.message,
        stack: emailError.stack
      });
      // Don't fail the store creation if email sending fails
    }

    res.status(201).json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        username: store.username,
        description: store.description,
        email: store.email,
        contact: store.contact,
        address: store.address,
        logo: store.logo,
        status: store.status,
        isActive: store.isActive,
        createdAt: store.createdAt,
      },
    });
  } catch (error) {
    console.error("Create store error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while creating store",
    });
  }
};


// 2. GET STORE BY USERNAME
export const getStoreByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const { includeInactive = 'false' } = req.query;

    // Enhanced logging for debugging
    console.log(`[Store Lookup] Username: ${username}, IncludeInactive: ${includeInactive}`);
    console.log(`[Store Lookup] Request headers:`, req.headers);
    console.log(`[Store Lookup] Request params:`, req.params);

    // Build query based on includeInactive parameter
    const query = { username };
    if (includeInactive !== 'true') {
      query.isActive = true;
    }

    console.log(`[Store Lookup] Query:`, query);

    const store = await storeModel.findOne(query);

    if (!store) {
      console.log(`[Store Lookup] Store not found for username: ${username}`);

      // Check if any store exists with this username regardless of status
      const anyStore = await storeModel.findOne({ username: username });
      if (anyStore) {
        console.log(`[Store Lookup] Store exists but is inactive. Status: ${anyStore.status}, isActive: ${anyStore.isActive}`);
      }

      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Store not found',
        details: {
          username,
          searchedWithActiveFilter: includeInactive !== 'true',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`[Store Lookup] Store found: ${store.name} (${store.id})`);

    res.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        username: store.username,
        description: store.description,
        email: store.email,
        contact: store.contact,
        address: store.address,
        logo: store.logo,
        status: store.status,
        isActive: store.isActive,
        createdAt: store.createdAt
      }
    });
  } catch (error) {
    console.error('Get store by username error:', error);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong while fetching store',
      details: {
        username: req.params.username,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};
 

 

// 3. DEBUG: GET STORES BY USER ID
export const getStoresByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[Store Debug] Checking stores for userId: ${userId}`);

    const stores = await storeModel.find({ userId });

    if (!stores || stores.length === 0) {
      console.log(`[Store Debug] No stores found for userId: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'No stores found for this user',
        details: {
          userId,
          timestamp: new Date().toISOString()
        }
      });
    }


    res.json({
      success: true,
      stores: stores.map(store => ({
        id: store.id,
        name: store.name,
        username: store.username,
        status: store.status,
        isActive: store.isActive,
        createdAt: store.createdAt
      })),
      count: stores.length
    });
  } catch (error) {
    console.error('Store debug error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong while checking stores',
      details: {
        userId: req.params.userId,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// 4. GET ALL STORES
export const getAllStores = async (req, res) => {
  try {
    const { includeInactive = 'false' } = req.query;

    const query = {};
    if (includeInactive !== 'true') {
      query.isActive = true;
    }

    const stores = await storeModel.find(query);

    // Get product counts for each store
    const storeIds = stores.map(store => store._id);
    const productCounts = await productModel.aggregate([
      { $match: { storeId: { $in: storeIds } } },
      { $group: { _id: "$storeId", productCount: { $sum: 1 } } }
    ]);

    // Create a map of storeId to product count
    const productCountMap = {};
    productCounts.forEach(item => {
      productCountMap[item._id.toString()] = item.productCount;
    });

    res.json({
      success: true,
      count: stores.length,
      stores: stores.map(store => ({
        id: store.id,
        name: store.name,
        username: store.username,
        description: store.description,
        email: store.email,
        contact: store.contact,
        address: store.address,
        logo: store.logo,
        status: store.status,
        isActive: store.isActive,
        productCount: productCountMap[store._id.toString()] || 0, // Add product count
        createdAt: store.createdAt,
      }))
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong while fetching all stores',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};

 

export const updateStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { action, status } = req.body; // Accept both action and status parameters
    
    // Support both formats: action ("approve"/"reject") and status ("approved"/"rejected")
    let storeAction = action;
    
    // If status is provided instead of action, convert it
    if (!action && status) {
      if (status === 'approved') {
        storeAction = 'approve';
      } else if (status === 'rejected') {
        storeAction = 'reject';
      }
    }
    
    // Validate the action
    if (!['approve', 'reject'].includes(storeAction)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Action must be either "approve" or "reject", or status must be either "approved" or "rejected"',
      });
    }

    const store = await storeModel.findOne({ id: storeId });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Store not found',
      });
    }

    if (storeAction === 'approve') {
      store.status = 'approved';
      store.isActive = true;
    } else if (storeAction === 'reject') {
      store.status = 'rejected';
      store.isActive = false;
    }

    await store.save();

    // ✅ Send email notification to store owner when approved
    if (storeAction === 'approve') {
      try {
        // Get the store owner's user information
        const storeOwner = await userModel.findOne({ id: store.userId });
        
        if (storeOwner && storeOwner.email) {
          await sendEmail({
            to: storeOwner.email,
            subject: "Store Approval - Your Store Has Been Approved!",
            html: `
              <h2>Congratulations! Your Store Has Been Approved</h2>
              <p>Hello ${storeOwner.name},</p>
              <p>Great news! Your store "${store.name}" has been approved and is now active.</p>
              <p><strong>Store Details:</strong></p>
              <ul>
                <li>Store Name: ${store.name}</li>
                <li>Username: ${store.username}</li>
                <li>Status: ${store.status}</li>
                <li>Approval Date: ${new Date().toLocaleString()}</li>
              </ul>
              <p>You can now start adding products and receiving orders through our platform.</p>
              <p>Thank you for choosing our e-commerce platform!</p>
            `
          });
          
          console.log(`📧 Approval email sent to store owner: ${storeOwner.email}`);
        } else {
          console.log("📧 No email found for store owner or store owner not found");
          console.log("📧 Store owner details:", storeOwner);
        }
      } catch (emailError) {
        console.error("❌ Error sending approval email to store owner:", emailError);
        // Don't fail the approval process if email sending fails
      }
    }

    return res.json({
      success: true,
      message: `Store has been ${storeAction}d successfully.`,
      store: {
        id: store.id,
        name: store.name,
        username: store.username,
        status: store.status,
        isActive: store.isActive,
        updatedAt: store.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update store status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong while updating store status',
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};
 

export const getPendingStores = async (req, res) => {
  try {
    // أولاً: نجيب المتاجر اللي حالتها pending
    const pendingStores = await storeModel.find({ status: "pending" });

    // لو مفيش متاجر
    if (!pendingStores.length) {
      return res.json({
        success: true,
        count: 0,
        stores: [],
        message: "No pending stores found",
      });
    }

    // ثانياً: نجيب بيانات المستخدمين لكل متجر حسب userId (اللي انت مخزنه كـ id مش _id)
    const userIds = pendingStores.map((store) => store.userId); // userId هو id الخاص بالمستخدم مش ObjectId
    const users = await userModel.find({ id: { $in: userIds } }).lean();

    // نحول المستخدمين إلى object سريع البحث
    const userMap = {};
    users.forEach((user) => {
      userMap[user.id] = user;
    });

    // ثالثاً: نجهز الرد النهائي
    const storesWithUsers = pendingStores.map((store) => {
      const user = userMap[store.userId] || null;

      return {
        id: store.id,
        name: store.name,
        username: store.username,
        description: store.description,
        email: store.email,
        contact: store.contact,
        address: store.address,
        logo: store.logo,
        status: store.status,
        isActive: store.isActive,
        createdAt: store.createdAt,

        // بيانات المستخدم
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              createdAt: user.createdAt,
            }
          : null,
      };
    });

    // رابعاً: نرجّع النتيجة
    res.json({
      success: true,
      count: storesWithUsers.length,
      stores: storesWithUsers,
    });
  } catch (error) {
    console.error("Get pending stores error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while fetching pending stores",
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find().lean(); // .lean() أسرع لأننا مش بنعدل

    if (!users.length) {
      return res.json({
        success: true,
        count: 0,
        users: [],
        message: "No users found",
      });
    }

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while fetching users",
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};



// 2️⃣ GET SINGLE USER BY ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.findOne({ id }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found",
        details: { id },
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get user by id error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while fetching user details",
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};



export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params; // user id (string)
    const { role } = req.body; // new role

    // تحقق إن الـ role اللي داخل صحيح
    const allowedRoles = ["user", "admin", "store"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }

    // تحديث المستخدم بناءً على الـ id (مش _id)
    const updatedUser = await userModel.findOneAndUpdate(
      { id },
      { role },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        image: updatedUser.image,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Something went wrong while updating user role",
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};