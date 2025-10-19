import storeModel from "../../../DB/models/store.model.js";
import userModel from "../../../DB/models/user.model.js";



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
      }})}}


      // 4. GET ALL STORES
export const getAllStores = async (req, res) => {
  try {
    const { includeInactive = 'false' } = req.query;

    const query = {};
    if (includeInactive !== 'true') {
      query.isActive = true;
    }

    const stores = await storeModel.find(query);

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
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Action must be either "approve" or "reject"',
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

    if (action === 'approve') {
      store.status = 'approved';
      store.isActive = true;
    } else if (action === 'reject') {
      store.status = 'rejected';
      store.isActive = false;
    }

    await store.save();

    return res.json({
      success: true,
      message: `Store has been ${action}d successfully.`,
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