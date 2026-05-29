const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { Dispute, Payment, User } = require("../models");
const { addCustomNotification } = require("./notification.service");

// Reason codes available per initiator role. Mirrors PRD §5.10.
const BUYER_REASONS = ["not_as_described", "low_quality", "late_delivery", "no_delivery", "other"];
const SELLER_REASONS = ["buyer_unresponsive", "scope_creep", "abusive_behavior", "other"];

const openDispute = async (userId, body) => {
  const { orderId, reasonCode, description, attachments = [] } = body;

  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");

  const isBuyer = String(order.clientId) === String(userId);
  const isSeller = String(order.freelancerId) === String(userId);
  if (!isBuyer && !isSeller) {
    throw new ApiError(httpStatus.FORBIDDEN, "Not a party to this order");
  }

  if (order.status === "disputed") {
    throw new ApiError(httpStatus.BAD_REQUEST, "A dispute is already open on this order");
  }
  if (order.status === "cancelled") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot dispute a cancelled order");
  }

  const initiatorRole = isBuyer ? "buyer" : "freelancer";
  const allowedReasons = isBuyer ? BUYER_REASONS : SELLER_REASONS;
  if (!allowedReasons.includes(reasonCode)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid reason for ${initiatorRole}`);
  }

  const dispute = await Dispute.create({
    orderId,
    initiatorId: userId,
    initiatorRole,
    reasonCode,
    description,
    attachments,
    status: "awaiting_response",
    responses: [
      {
        userId,
        role: initiatorRole,
        message: description,
        attachments,
      },
    ],
  });

  order.preDisputeStatus = order.status;
  order.status = "disputed";
  order.activeDisputeId = dispute._id;
  await order.save();

  const otherPartyId = isBuyer ? order.freelancerId : order.clientId;
  const otherRole = isBuyer ? "freelancer" : "buyer";
  const initiator = await User.findById(userId).select("fullName username");
  const initiatorName = initiator?.fullName || initiator?.username || "User";

  // Notify counterparty
  if (otherPartyId) {
    await addCustomNotification(
      `${otherRole}-notification`,
      otherPartyId,
      {
        receiverId: otherPartyId,
        role: otherRole,
        type: "order",
        linkId: String(dispute._id),
        message: `${initiatorName} opened a dispute on your order.`,
      }
    );
  }

  // Notify admin queue
  await addCustomNotification("admin-notification", "admin", {
    role: "admin",
    type: "order",
    linkId: String(dispute._id),
    message: `New dispute opened by ${initiatorName} (${initiatorRole}).`,
  });

  return dispute;
};

const respondToDispute = async (userId, disputeId, body) => {
  const { message, attachments = [], proposedResolution = null } = body;

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");
  if (["resolved", "cancelled"].includes(dispute.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Dispute is closed");
  }

  const order = await Payment.findById(dispute.orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");

  const isBuyer = String(order.clientId) === String(userId);
  const isSeller = String(order.freelancerId) === String(userId);
  if (!isBuyer && !isSeller) {
    throw new ApiError(httpStatus.FORBIDDEN, "Not a party to this dispute");
  }

  const role = isBuyer ? "buyer" : "freelancer";
  dispute.responses.push({ userId, role, message, attachments, proposedResolution });
  dispute.status = "awaiting_response";
  await dispute.save();

  const otherPartyId = isBuyer ? order.freelancerId : order.clientId;
  const otherRole = isBuyer ? "freelancer" : "buyer";
  if (otherPartyId) {
    await addCustomNotification(
      `${otherRole}-notification`,
      otherPartyId,
      {
        receiverId: otherPartyId,
        role: otherRole,
        type: "order",
        linkId: String(dispute._id),
        message: "New response on your dispute.",
      }
    );
  }

  return dispute;
};

const escalateDispute = async (userId, disputeId) => {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");
  if (dispute.status === "resolved") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Already resolved");
  }
  const order = await Payment.findById(dispute.orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const isParty = [String(order.clientId), String(order.freelancerId)].includes(String(userId));
  if (!isParty) throw new ApiError(httpStatus.FORBIDDEN, "Not a party to this dispute");

  dispute.status = "escalated";
  await dispute.save();

  await addCustomNotification("admin-notification", "admin", {
    role: "admin",
    type: "order",
    linkId: String(dispute._id),
    message: "A dispute has been escalated and needs admin review.",
  });

  return dispute;
};

const resolveDispute = async (adminId, disputeId, body) => {
  const { resolution, resolutionNote = "" } = body;
  const allowed = ["full_refund", "partial_refund", "release_to_seller", "mutual_cancellation"];
  if (!allowed.includes(resolution)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid resolution");
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");
  if (dispute.status === "resolved") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Already resolved");
  }
  const order = await Payment.findById(dispute.orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");

  dispute.resolution = resolution;
  dispute.resolutionNote = resolutionNote;
  dispute.status = "resolved";
  dispute.resolvedByAdminId = adminId;
  dispute.resolvedAt = new Date();
  await dispute.save();

  // Map resolution → order status. Real refund/payout side-effects
  // would happen in the payment service; here we only set the
  // canonical order status so the marketplace sees a final state.
  if (resolution === "release_to_seller") {
    order.status = "delivered";
  } else {
    order.status = "cancelled";
    order.cancellationReason = `Dispute: ${resolution}`;
    order.cancelledAt = new Date();
    order.cancelledFromStatus = "disputed";
  }
  order.activeDisputeId = null;
  await order.save();

  // Notify both parties
  if (order.clientId) {
    await addCustomNotification("buyer-notification", order.clientId, {
      receiverId: order.clientId,
      role: "buyer",
      type: "order",
      linkId: String(dispute._id),
      message: `Your dispute has been resolved: ${resolution.replace(/_/g, " ")}.`,
    });
  }
  if (order.freelancerId) {
    await addCustomNotification("freelancer-notification", order.freelancerId, {
      receiverId: order.freelancerId,
      role: "freelancer",
      type: "order",
      linkId: String(dispute._id),
      message: `Your dispute has been resolved: ${resolution.replace(/_/g, " ")}.`,
    });
  }

  return dispute;
};

const cancelDispute = async (userId, disputeId) => {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");
  if (String(dispute.initiatorId) !== String(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the initiator can withdraw a dispute");
  }
  if (["resolved", "cancelled"].includes(dispute.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Dispute is closed");
  }

  const order = await Payment.findById(dispute.orderId);
  if (order) {
    order.status = dispute.initiatorRole && order.preDisputeStatus ? order.preDisputeStatus : "active";
    order.preDisputeStatus = "";
    order.activeDisputeId = null;
    await order.save();
  }
  dispute.status = "cancelled";
  await dispute.save();
  return dispute;
};

const getMyDisputes = async (userId, providedFilter = {}, providedOptions = {}) => {
  const filter = { ...providedFilter };
  // Find disputes where this user is the initiator OR a party to the underlying order
  const orderIdsAsParty = await Payment.find({
    $or: [{ clientId: userId }, { freelancerId: userId }],
  }).distinct("_id");
  filter.$or = [
    { initiatorId: new mongoose.Types.ObjectId(userId) },
    { orderId: { $in: orderIdsAsParty } },
  ];
  const options = Object.assign(
    { sortBy: "createdAt:desc", limit: 10, page: 1, populate: "orderId,initiatorId" },
    providedOptions
  );
  return Dispute.paginate(filter, options);
};

const getDisputeById = async (disputeId) => {
  const dispute = await Dispute.findById(disputeId)
    .populate("orderId")
    .populate("initiatorId", "fullName username email image")
    .populate("responses.userId", "fullName username image role")
    .populate("resolvedByAdminId", "fullName username email");
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");
  return dispute;
};

const queryDisputesAdmin = async (providedFilter = {}, providedOptions = {}) => {
  const options = Object.assign(
    { sortBy: "createdAt:desc", limit: 20, page: 1, populate: "orderId,initiatorId" },
    providedOptions
  );
  return Dispute.paginate(providedFilter, options);
};

module.exports = {
  openDispute,
  respondToDispute,
  escalateDispute,
  resolveDispute,
  cancelDispute,
  getMyDisputes,
  getDisputeById,
  queryDisputesAdmin,
};
