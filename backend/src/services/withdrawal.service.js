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

  const method = body.method || "bank";
  if (!["bank", "paypal", "payoneer"].includes(method)) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown payout method");
  const m = (await require("./siteSettings.service").get()).marketplace;
  const min = { bank: m.withdrawMinBank, paypal: m.withdrawMinPaypal, payoneer: m.withdrawMinPayoneer }[method];
  const label = { bank: "bank transfer", paypal: "PayPal", payoneer: "Payoneer" }[method];
  if (Number(body.withdrawalAmount) < min) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Minimum withdrawal by ${label} is $${min}`);
  }
  if (Number(body.withdrawalAmount) > m.withdrawMax) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Maximum withdrawal is $${m.withdrawMax}`);
  }
  const account = String(body.payoutAccount || "").trim();
  if (method === "bank" && (!body.bankName || !body.accountNumber || !body.accountType)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "bankName, accountNumber and accountType are required");
  }
  if (method === "paypal" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) throw new ApiError(httpStatus.BAD_REQUEST, "Enter your PayPal email");
  if (method === "payoneer" && !/^[A-Za-z0-9_-]{3,64}$/.test(account)) throw new ApiError(httpStatus.BAD_REQUEST, "Enter your Payoneer payee id");
  // Changed payout details: wait payoutChangeHoldHours before paying out.
  const fingerprint = method === "bank" ? `bank:${String(body.bankName).trim()}:${String(body.accountNumber).trim()}` : `${method}:${account.toLowerCase()}`;
  const saved = user.payoutDetails || {};
  const holdMs = Number(m.payoutChangeHoldHours || 0) * 3600000;
  if (saved.fingerprint !== fingerprint) {
    await User.updateOne({ _id: userId }, { $set: { payoutDetails: { fingerprint, changedAt: new Date() } } });
    if (saved.fingerprint && holdMs > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, `New payout details saved. For your security you can withdraw to them after ${m.payoutChangeHoldHours} hours.`);
    }
  } else if (holdMs > 0 && saved.changedAt && Date.now() - new Date(saved.changedAt).getTime() < holdMs) {
    const left = Math.ceil((holdMs - (Date.now() - new Date(saved.changedAt).getTime())) / 3600000);
    throw new ApiError(httpStatus.BAD_REQUEST, `Your payout details changed recently. You can withdraw in about ${left} hour${left === 1 ? "" : "s"}.`);
  }
  const amount = Number(body.withdrawalAmount);
  if (!Number.isFinite(amount)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid amount");
  // Atomic debit so two parallel requests can't overdraw the balance.
  const debited = await User.findOneAndUpdate({ _id: userId, balance: { $gte: amount } }, { $inc: { balance: -amount } });
  if (!debited) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient balance");
  }

  const withdrawal = await Withdrawal.create({
    method,
    ...(method === "bank"
      ? { bankName: body.bankName, accountNumber: body.accountNumber, accountType: body.accountType }
      : { payoutAccount: account, bankName: method === "paypal" ? "PayPal" : "Payoneer" }),
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
      bankName: method === "bank" ? body.bankName : method === "paypal" ? "PayPal" : "Payoneer",
      accountNumber: method === "bank" ? body.accountNumber : account,
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
  // Claim it first so two approvals can't both send money.
  const claimed = await Withdrawal.findOneAndUpdate({ _id: withdrawalId, status: "Pending" }, { $set: { status: "Processing" } }, { new: true });
  if (!claimed) {
    const exists = await Withdrawal.exists({ _id: withdrawalId });
    throw new ApiError(exists ? httpStatus.CONFLICT : httpStatus.NOT_FOUND, exists ? "Only pending withdrawals can be approved" : "Withdrawal not found");
  }
  let payout;
  try {
    payout = await require("./payouts.service").send(claimed);
  } catch (e) {
    // Provider refused: back to Pending so finance can retry or decline.
    await Withdrawal.updateOne({ _id: claimed._id }, { $set: { status: "Pending", payout: { provider: claimed.method, status: "failed", error: String(e.message).slice(0, 300), at: new Date() } } });
    throw new ApiError(httpStatus.BAD_GATEWAY, e.message);
  }
  const withdrawal = await Withdrawal.findOneAndUpdate({ _id: claimed._id }, { $set: { status: "Completed", payout } }, { new: true });
  const user = await userService.getUserById(withdrawal?.userId);
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
