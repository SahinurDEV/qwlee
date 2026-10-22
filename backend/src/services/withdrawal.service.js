const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { userService } = require(".");
const { addCustomNotification } = require("./notification.service");
const emailService = require("./email.service");
const { Withdrawal, User } = require("../models");

const createWithdrawal = async (userId, body) => {
  const user = await userService.getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (body.withdrawalAmount < 20) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Minimum withdrawal amount is 20"
    );
  }
  if (body.withdrawalAmount > 10000) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Maximum withdrawal amount is 10000"
    );
  }

  if (!body.bankName || !body.accountNumber || !body.accountType) {
    throw new ApiError(httpStatus.BAD_REQUEST, "bankName, accountNumber and accountType are required");
  }
  const amount = Number(body.withdrawalAmount);
  if (!Number.isFinite(amount)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid amount");
  // Atomic debit so two parallel requests can't overdraw the balance.
  const debited = await User.findOneAndUpdate({ _id: userId, balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (!debited) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient balance");
  }

  const withdrawal = await Withdrawal.create({
    bankName: body.bankName,
    accountNumber: body.accountNumber,
    accountType: body.accountType,
    withdrawalAmount: Number(body.withdrawalAmount),
    userId,
  });

  const newNotificationAdmin = {
    role: "admin",
    message: `${user.fullName} has sent withdrawn request $${body.withdrawalAmount}.`,
  };

  await addCustomNotification(
    "admin-notification",
    "admin",
    newNotificationAdmin
  );

  if (user.email) {
    emailService.sendWithdrawalRequested(user.email, {
      recipientName: user.fullName || user.username,
      amount: body.withdrawalAmount,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
    });
  }

  return { withdrawal, user };
};

const withdrawalCancel = async (withdrawalId, reason) => {
  const pending = await Withdrawal.findOneAndUpdate(
    { _id: withdrawalId, status: "Pending" },
    { $set: { status: "Failed", ...(reason ? { cancelReason: String(reason).slice(0, 500) } : {}) } },
    { new: true }
  );
  if (!pending) {
    const exists = await Withdrawal.exists({ _id: withdrawalId });
    throw new ApiError(exists ? httpStatus.CONFLICT : httpStatus.NOT_FOUND, exists ? "Only pending withdrawals can be declined" : "Withdrawal not found");
  }
  const withdrawal = pending;
  const user = await userService.getUserById(withdrawal?.userId);
  if (withdrawal.status === "Completed") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Withdrawal already completed");
  }
  if (!withdrawal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Withdrawal not found");
  }
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const newNotificationFreelancer = {
    receiverId: withdrawal.userId,
    role: "freelancer",
    message: `Your withdrawal $${withdrawal.withdrawalAmount} has been cancelled.`,
  };

  await addCustomNotification(
    "freelancer-notification",
    withdrawal.userId,
    newNotificationFreelancer
  );

  // Return the held amount exactly once (status swap above is atomic).
  await User.updateOne({ _id: withdrawal.userId }, { $inc: { balance: withdrawal.withdrawalAmount } });

  if (user.email) {
    emailService.sendWithdrawalDeclined(user.email, {
      recipientName: user.fullName || user.username,
      amount: withdrawal.withdrawalAmount,
      reason: withdrawal.cancelReason || "",
    });
  }

  return withdrawal;
};

const queryWithdrawals = async (status, filter, providedOptions) => {
  if (status) {
    filter.status = status;
  }

  // Merge provided options with default options
  const options = Object.assign(
    {
      sortBy: "createdAt:desc",
      limit: 10,
      page: 1,
      populate: "userId", // Populate the userId field
    },
    providedOptions
  );

  // Call Withdrawal.paginate() with provided filter and options
  const withdrawals = await Withdrawal.paginate(filter, options);
  return withdrawals;
};

const getSingleUserWithdrawals = async (userId) => {
  const withdrawals = await Withdrawal.find({ userId })
    .populate("userId", "email fullName image role")
    .sort({ createdAt: -1 });
  return withdrawals;
};

const withdrawalApprove = async (withdrawalId) => {
  const withdrawal = await Withdrawal.findOneAndUpdate({ _id: withdrawalId, status: "Pending" }, { $set: { status: "Completed" } }, { new: true });
  if (!withdrawal) {
    const exists = await Withdrawal.exists({ _id: withdrawalId });
    throw new ApiError(exists ? httpStatus.CONFLICT : httpStatus.NOT_FOUND, exists ? "Only pending withdrawals can be approved" : "Withdrawal not found");
  }
  const user = await userService.getUserById(withdrawal?.userId);
  if (withdrawal.status === "Completed") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Withdrawal already completed");
  }
  if (!withdrawal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Withdrawal not found");
  }
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const newNotificationFreelancer = {
    receiverId: withdrawal.userId,
    role: "freelancer",
    message: `Your withdrawal $${withdrawal.withdrawalAmount} has been Completed.`,
  };

  await addCustomNotification(
    "freelancer-notification",
    withdrawal.userId,
    newNotificationFreelancer
  );

  if (user.email) {
    emailService.sendWithdrawalApproved(user.email, {
      recipientName: user.fullName || user.username,
      amount: withdrawal.withdrawalAmount,
      bankName: withdrawal.bankName,
    });
  }

  return withdrawal;
};

const getSingleWithdrawal = async (withdrawalId) => {
  const withdrawal = await Withdrawal.findOne({ _id: withdrawalId }).populate(
    "userId",
    "email fullName image role"
  );
  return withdrawal;
};

module.exports = {
  createWithdrawal,
  queryWithdrawals,
  withdrawalCancel,
  getSingleUserWithdrawals,
  withdrawalApprove,
  getSingleWithdrawal,
};
