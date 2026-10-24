const { generateOtp } = require("../utils/otp");
const { escapeRegex } = require("../utils/publicUser");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { sendEmailVerification } = require("./email.service");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const { default: mongoose } = require("mongoose");
const Message = require("../models/message.model");

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }

  const oneTimeCode =
    generateOtp();

  if (userBody.role === "buyer" || userBody.role === "freelancer") {
    sendEmailVerification(userBody.email, oneTimeCode);
  }
  return User.create({ ...userBody, oneTimeCode });
};

const queryUsers = async (filter, options, { isAdmin = false } = {}) => {
  const query = {};
  if (!isAdmin) {
    // Public directory: only active, non-banned sellers; never search by email.
    delete filter.email;
    query.role = "freelancer";
    query.isDeleted = { $ne: true };
    query.isBan = { $ne: true };
  }
  // Loop through each filter field and add conditions if they exist
  for (const key of Object.keys(filter)) {
    if (
      (key === "fullName" || key === "email" || key === "username") &&
      filter[key] !== ""
    ) {
      query[key] = { $regex: escapeRegex(filter[key]), $options: "i" }; // Case-insensitive search
    } else if (filter[key] !== "" && !(key === "role" && !isAdmin)) {
      query[key] = filter[key];
    }
  }
  const users = await User.paginate(query, options);
  return users;
};

const getUserById = async (id) => {
  return User.findById(id);
};

const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

const getUserByUsername = async (username) => {
  if (!username) return null;
  return User.findOne({
    username: String(username).toLowerCase(),
    isDeleted: { $ne: true },
  });
};

const isUsernameTaken = async (username, excludeUserId) => {
  if (!username) return false;
  const query = { username: String(username).toLowerCase() };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  return !!(await User.findOne(query));
};

const updateUserById = async (userId, updateBody, image) => {
  const user = await getUserById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }

  Object.assign(user, updateBody);
  await user.save();
  return user;
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  await user.remove();
  return user;
};

const isUpdateUser = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const oneTimeCode =
    generateOtp();
  const annualIncome = updateBody.income * 12;

  if (updateBody.role === "buyer" || updateBody.role === "freelancer") {
    sendEmailVerification(updateBody.email, oneTimeCode);
  }

  Object.assign(user, updateBody, {
    isDeleted: false,
    isSuspended: false,
    isEmailVerified: false,
    isResetPassword: false,
    isPhoneNumberVerified: false,
    oneTimeCode: oneTimeCode,
    annualIncome: annualIncome,
  });
  await user.save();
  return user;
};

// Shared aggregation that powers both /users/public?userId= and
// /users/by-username/:username. Match stage is passed in by the caller.
const aggregatePublicProfile = async (matchStage) => {
  const result = await User.aggregate([
    { $match: { ...matchStage, isDeleted: { $ne: true } } },
    {
      $lookup: {
        from: "gigs",
        localField: "_id",
        foreignField: "userId",
        pipeline: [{ $match: { gigStatus: "active", isDeleted: { $ne: true } } }],
        as: "gigs",
      },
    },
    {
      $lookup: {
        from: "portfolios",
        localField: "_id",
        foreignField: "userId",
        as: "portfolios",
      },
    },
    {
      $lookup: {
        from: "reviews",
        let: { userId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$freelancerId", "$$userId"] } } },
        ],
        as: "reviews",
      },
    },
    {
      $project: {
        fullName: 1,
        gender: 1,
        username: 1,
        image: 1,
        coverImage: 1,
        location: 1,
        role: 1,
        intro: 1,
        about: 1,
        skills: 1,
        online: 1,
        isProfileCompleted: 1,
        planBadge: 1,
        isPro: 1,
        perHourRate: 1,
        responseTime: 1,
        language: 1,
        languages: 1,
        certifications: 1,
        review: 1,
        sellerLevel: 1,
        createdAt: 1,
        gigs: 1,
        portfolios: 1,
        reviews: { $ifNull: ["$reviews", []] },
      },
    },
  ]);
  return result[0];
};

// Average chat response time for a seller, cached for 15 minutes. The
// rounded-up hours are also saved to user.responseTime, which the seller
// level score reads.
const rtCache = new Map();
const sellerResponseTime = async (userId) => {
  const key = String(userId);
  const hit = rtCache.get(key);
  if (hit && hit.at > Date.now() - 15 * 60000) return hit.value;
  const value = await require("./message.service").responseStats(userId);
  rtCache.set(key, { at: Date.now(), value });
  if (rtCache.size > 5000) rtCache.delete(rtCache.keys().next().value);
  if (value.avgMinutes) {
    const hours = Math.max(1, Math.ceil(value.avgMinutes / 60));
    User.updateOne({ _id: userId, responseTime: { $ne: String(hours) } }, { $set: { responseTime: String(hours) } }).catch(() => {});
  }
  return value;
};

const getPublicProfileByUsername = async (username) => {
  return aggregatePublicProfile({ username: String(username).toLowerCase() });
};

const getUsersPublicById = async (userId) => {
  const user = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "gigs",
        localField: "_id",
        foreignField: "userId",
        pipeline: [{ $match: { gigStatus: "active", isDeleted: { $ne: true } } }],
        as: "gigs",
      },
    },
    {
      $lookup: {
        from: "portfolios",
        localField: "_id",
        foreignField: "userId",
        as: "portfolios",
      },
    },
    {
      $lookup: {
        from: "reviews",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$freelancerId", "$$userId"] },
            },
          },
        ],
        as: "reviews",
      },
    },
    {
      $project: {
        fullName: 1,
        gender: 1,
        username: 1,
        image: 1,
        location: 1,
        role: 1,
        intro: 1,
        about: 1,
        skills: 1,
        online: 1,
        isProfileCompleted: 1,
        planBadge: 1,
        isPro: 1,
        isEmailVerified: 1,
        perHourRate: 1,
        responseTime: 1,
        language: 1,
        languages: 1,
        certifications: 1,
        review: 1,
        sellerLevel: 1,
        gigs: 1,
        portfolios: 1,
        reviews: { $ifNull: ["$reviews", []] }, // Ensure reviews is an empty array if null
      },
    },
  ]);

  return user[0]; // Return the first (and only) result
};

const getUserStats = async (freelancerId) => {
  try {
    // Step 1: Aggregate orders for the specific freelancer, excluding totalEarnings
    const stats = await Payment.aggregate([
      {
        $match: {
          freelancerId: new mongoose.Types.ObjectId(freelancerId), // Filter orders by freelancerId
          status: 'delivered'  // Only delivered orders
        }
      },
      {
        $group: {
          _id: '$freelancerId',    // Group by freelancerId
          totalOrders: { $sum: 1 },  // Count the number of delivered orders
          clients: { $addToSet: '$clientId' }  // Get a list of unique clients
        }
      }
    ]);

    // Step 2: Check if stats exist and handle accordingly
    if (stats.length === 0) {
      return { message: 'No delivered orders found for this freelancer' };
    }

    // Step 3: Fetch additional client info for reporting
    const uniqueClients = stats[0].clients;

    // Step 4: Response time from chat (time from a new inbound message
    // to the seller's next reply, last 60 days).
    const rt = await sellerResponseTime(freelancerId);
    const averageResponseTime = rt.avgMinutes || 0;
    const lastSent = await Message.findOne({ sender: freelancerId }).sort({ createdAt: -1 }).select("createdAt").lean();
    const lastResponseTime = lastSent ? (Date.now() - new Date(lastSent.createdAt).getTime()) / 60000 : 0;

    // Step 7: Prepare response with stats, last response time, and average response time
    return {
      totalOrders: stats[0]?.totalOrders,
      uniqueClientCount: uniqueClients?.length,
      lastResponseTime,
      averageResponseTime
    };

  } catch (error) {
    console.error('Error fetching user stats with aggregation:', error);
    throw new Error('Could not fetch user stats');
  }
};



module.exports = {
  getUserStats
};


module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  isUsernameTaken,
  updateUserById,
  deleteUserById,
  isUpdateUser,
  getUsersPublicById,
  getPublicProfileByUsername,
  sellerResponseTime,
  getUserStats,
};
