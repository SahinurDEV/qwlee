const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const Gig = require("../models/gig.model");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getTotalStatus = async () => {
  // Aggregation pipeline for users
  const userAggregation = [
    {
      $facet: {
        totalFreelancer: [
          { $match: { role: "freelancer" } },
          { $count: "count" }
        ],
        totalBuyer: [
          { $match: { role: "buyer" } },
          { $count: "count" }
        ]
      }
    },
    {
      $project: {
        totalFreelancer: { $arrayElemAt: ["$totalFreelancer.count", 0] },
        totalBuyer: { $arrayElemAt: ["$totalBuyer.count", 0] }
      }
    }
  ];

  const userResult = await User.aggregate(userAggregation);
  const totalFreelancer = userResult[0]?.totalFreelancer || 0;
  const totalBuyer = userResult[0]?.totalBuyer || 0;
  // Aggregation pipeline for gigs
  const totalGigs = await Gig.countDocuments();

  // Aggregation pipeline for payments
  const paymentAggregation = [
    {
      $unwind: "$items"
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
      }
    }
  ];

  const paymentResult = await Payment.aggregate(paymentAggregation);
  const totalEarnings = paymentResult[0]?.totalEarnings || 0;

  return {
    totalEarnings,
    totalFreelancer,
    totalBuyer,
    totalGigs,
  };
};

const getIncomeRatio = async (year) => {
  // Aggregate payments to get the monthly earnings
  const payments = await Payment.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $unwind: '$items',
    },
    {
      $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
        totalEarnings: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
    {
      $project: {
        _id: 0,
        month: '$_id.month',
        totalEarnings: 1,
      },
    },
  ]);

  // Initialize an array with all months set to 0 earnings
  const monthlyIncomeRatio = monthNames.map((month, index) => ({
    month,
    totalEarnings: 0,
  }));

  // Update the array with actual earnings
  payments.forEach(payment => {
    monthlyIncomeRatio[payment.month - 1].totalEarnings = payment.totalEarnings;
  });

  return monthlyIncomeRatio;
};

const getUserRatio = async (month) => {
  let startDate, endDate;
  if (month) {
    // Convert the month parameter to a range of dates
    startDate = new Date(`${new Date().getFullYear()}-${month}-01`);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  } else {
    // If no month is provided, use the entire year
    startDate = new Date(`${new Date().getFullYear()}-01-01`);
    endDate = new Date(`${new Date().getFullYear()}-12-31`);
  }

  const freelancers = await User.countDocuments({
    role: "freelancer",
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const buyers = await User.countDocuments({
    role: "buyer",
    createdAt: { $gte: startDate, $lte: endDate }
  });

  return {
    month: month ? monthNames[startDate.getMonth()] : "Yearly",
    totalFreelancers: freelancers,
    totalBuyers: buyers,
    ratio: buyers !== 0 ? freelancers / buyers : 0,
  };
};

const getRecentUsers = async (filter, options) => {

  filter["role"] = "freelancer";
  options.sortBy = "createdAt:desc";
  const users = await User.paginate(filter, options);
  return users;
}
const queryEarning = async (filter, options) => {
  options.populate = [
    { path: "gigId", populate: { path: "categoriesId" } },
    { path: "clientId" }
  ];

  const result = await Payment.paginate(filter, options);
  // Calculate total earnings
  let totalEarnings = 0;
  result.results.forEach((payment) => {
    payment.items.forEach((item) => {
      totalEarnings += item.price * item.quantity;
    });
  });

  return {
    ...result,
    totalEarnings,
  };
};

// Full platform orders (admin scope). Mirrors queryEarning but returns
// every payment, populated for the admin table.
const queryAllOrders = async (filter = {}, options = {}) => {
  options.populate = [
    { path: "gigId" },
    { path: "freelancerId" },
    { path: "clientId" },
  ];
  options.sortBy = options.sortBy || "createdAt:desc";
  if (!options.limit) options.limit = 50;
  const query = {};
  if (filter.status) query.status = filter.status;
  const result = await Payment.paginate(query, options);
  return result;
};

// Full platform gigs (admin scope). Skips the marketplace's
// "exclude own gigs" filter — the admin sees everything.
const queryAllGigs = async (filter = {}, options = {}) => {
  options.populate = [{ path: "userId" }, { path: "categoriesId" }];
  options.sortBy = options.sortBy || "createdAt:desc";
  if (!options.limit) options.limit = 50;
  const query = {};
  if (filter.title) query.title = { $regex: filter.title, $options: "i" };
  if (filter.categories) query.categoriesId = filter.categories;
  const result = await Gig.paginate(query, options);
  return result;
};

// Set/clear the ban state on a user. `reason` is shown on the sign-in
// page when the user tries to log in. Admins themselves can't be
// banned through this endpoint — protects the system from being locked
// out by a rogue admin action.
const banUser = async (userId, { reason = "", days } = {}) => {
  const d = days === undefined || days === null || days === "" ? null : Number(days);
  if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= 365)) throw new ApiError(httpStatus.BAD_REQUEST, "days must be a whole number from 1 to 365");
  const user = await User.findById(userId);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (user.role === "admin")
    throw new ApiError(httpStatus.FORBIDDEN, "Admins cannot be banned");
  user.isBan = true;
  user.banReason =
    (reason && reason.trim()) ||
    "Your account has been suspended by an administrator.";
  user.bannedAt = new Date();
  user.bannedUntil = d ? new Date(Date.now() + d * 86400000) : null;
  await user.save();

  // Force-logout every active session for this user in real time. The
  // socket room is keyed by userId (see socketServer.js), so emitting
  // to that room reaches all of the user's open tabs/devices at once.
  // The frontend's SocketProvider listens for `auth/force-logout` and
  // clears cookies + redirects to /sign-in.
  try {
    const { io } = require("../socket/socketServer");
    io.to(String(user._id)).emit("auth/force-logout", {
      reason: user.banReason,
      bannedAt: user.bannedAt,
    });
  } catch (e) {
    /* socket emission must never block the ban itself */
  }

  try {
    const emailService = require("./email.service");
    if (user.email) {
      emailService.sendAccountBanned(user.email, {
        recipientName: user.fullName || user.username,
        reason: user.banReason,
      });
    }
  } catch (e) {
    /* swallow */
  }
  return user;
};

// Admin force-cancel — Fiverr-support style. Works on any order
// regardless of status. If the order was previously settled to the
// freelancer (status === "delivered"), we claw back the
// commission-adjusted amount from their balance so the books stay
// consistent. Sends cancellation emails to both parties.
const cancelOrder = async (orderId, { reason = "", adminId } = {}) => {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (order.status === "cancelled") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Order is already cancelled");
  }

  const wasSettled = order.status === "delivered";
  if (wasSettled && order.freelancerId) {
    const amount = Number(order?.items?.[0]?.price || 0);
    // Reverse exactly what was credited; legacy orders (before the
    // settlement snapshot existed) used the old fixed 5% fee.
    const credited = order.sellerEarning != null ? order.sellerEarning : amount * 0.95;
    if (credited > 0) {
      await User.findByIdAndUpdate(order.freelancerId, {
        $inc: { balance: -credited },
      });
    }
  }

  const prevStatus = order.status;
  order.status = "cancelled";
  // Stamp the cancellation source so we can distinguish admin overrides
  // from regular buyer/seller cancellations in audits.
  order.cancellationReason =
    `[Admin override] ${String(reason || "").trim() || "Cancelled by admin support."}`.slice(0, 500);
  order.cancelledBy = adminId || null;
  order.cancelledAt = new Date();
  order.cancelledFromStatus = prevStatus;
  await order.save();

  // Email both parties using the cancellation template. Lazy-require to
  // avoid a circular dep with email.service.
  try {
    const emailService = require("./email.service");
    const [buyer, seller, gig] = await Promise.all([
      User.findById(order.clientId).select("fullName email username"),
      User.findById(order.freelancerId).select("fullName email username"),
      order.gigId
        ? Gig.findById(order.gigId).select("title")
        : null,
    ]);
    const ctx = {
      gigTitle: gig?.title || "your gig",
      orderId: order._id,
      reason: order.cancellationReason,
    };
    if (buyer?.email) {
      emailService.sendOrderCancelled(buyer.email, {
        ...ctx,
        recipientName: buyer.fullName || buyer.username,
      });
    }
    if (seller?.email) {
      emailService.sendOrderCancelled(seller.email, {
        ...ctx,
        recipientName: seller.fullName || seller.username,
      });
    }
  } catch (e) {
    /* swallow */
  }

  return order;
};

const unbanUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  user.isBan = false;
  user.banReason = "";
  user.bannedAt = null;
  user.bannedUntil = null;
  await user.save();
  return user;
};

module.exports = {
  getTotalStatus,
  getIncomeRatio,
  getUserRatio,
  getRecentUsers,
  queryEarning,
  queryAllOrders,
  queryAllGigs,
  banUser,
  unbanUser,
  cancelOrder,
};
