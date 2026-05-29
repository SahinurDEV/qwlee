const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");
const Payment = require("../models/payment.model");
const Orders = require("../models/orders.model");
const { addCustomNotification } = require("./notification.service");
const emailService = require("./email.service");
const Gig = require("../models/gig.model");

const STATUS_KEYS = ["active", "late", "delivered", "cancelled", "disputed"];

// Count orders per status for the manage-orders tab badges. `role` is
// either "buyer" or "seller" (matches the user's view mode), so a single
// account can pull either side's counts.
const getOrderCounts = async (userId, role = "buyer") => {
  const matchKey = role === "seller" ? "freelancerId" : "clientId";
  const match = {
    [matchKey]: new mongoose.Types.ObjectId(userId),
    isDeleted: { $ne: true },
  };
  const grouped = await Payment.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  let total = 0;
  for (const row of grouped) {
    if (counts.hasOwnProperty(row._id)) counts[row._id] = row.count;
    total += row.count;
  }
  return { ...counts, all: total };
};

const orderCreate = async (body, clientId) => {
  const newBody = {
    ...body,
    clientId,
  };
  const order = Orders.create(newBody);
  return order;
};

const getOrders = async (filter, options, userId) => {
  filter.clientId = userId;
  options.populate = [
    {
      path: "gigId",
    },
    {
      path: "freelancerId",
    },
    {
      path: "clientId",
    },
  ];

  // Retrieve the paginated orders
  const orders = await Orders.paginate(filter, options);

  return orders;
};

const getOrderById = async (orderId) => {
  const order = await Payment.findById(orderId).populate(
    "gigId freelancerId clientId"
  );
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  return order;
};
const freelancerOrdersList = async (filter, options, userId) => {
  filter.freelancerId = userId;
  options.populate = [
    {
      path: "gigId",
    },
    {
      path: "freelancerId",
    },
    {
      path: "clientId",
    },
  ];

  // Retrieve the paginated orders
  const orders = await Payment.paginate(filter, options);

  return orders;
};

const createOrderRequest = async (body) => {
  const order = Orders.create(body);
  return order;
};

const getMyOrders = async (filter, options, userId) => {
  options.populate = [
    {
      path: "gigId",
    },
    {
      path: "freelancerId",
    },
    {
      path: "clientId",
    },
  ];

  filter.clientId = userId;
  // Retrieve the paginated orders
  const orders = await Payment.paginate(filter, options);

  return orders;
};

const orderModify = async (paymentId, body, userId) => {
  const order = await Payment.findById(paymentId);
  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }

  const prevStatus = order.status;
  Object.assign(order, body);
  await order.save();

  // Email side-effects on a state transition. Wrapped in try/catch so a
  // template / SMTP hiccup never breaks the order update itself.
  if (prevStatus !== order.status) {
    try {
      const [buyer, seller, gig] = await Promise.all([
        User.findById(order.clientId).select("fullName email username"),
        User.findById(order.freelancerId).select("fullName email username"),
        order.gigId ? Gig.findById(order.gigId).select("title") : null,
      ]);
      const ctx = {
        buyerName: buyer?.fullName || buyer?.username,
        sellerName: seller?.fullName || seller?.username,
        gigTitle: gig?.title || "your gig",
        orderId: order._id,
        price: order?.items?.[0]?.price,
      };
      if (order.status === "delivered" && seller?.email) {
        // status "delivered" in this app = buyer accepted (orderModify
        // is the path that sets it); the seller therefore gets paid.
        emailService.sendDeliveryAcceptedSeller(seller.email, {
          ...ctx,
          buyerName: ctx.buyerName,
        });
      }
      if (order.status === "cancelled") {
        if (buyer?.email)
          emailService.sendOrderCancelled(buyer.email, {
            recipientName: ctx.buyerName,
            gigTitle: ctx.gigTitle,
            orderId: ctx.orderId,
            reason: body.reason,
          });
        if (seller?.email)
          emailService.sendOrderCancelled(seller.email, {
            recipientName: ctx.sellerName,
            gigTitle: ctx.gigTitle,
            orderId: ctx.orderId,
            reason: body.reason,
          });
      }
    } catch (e) {
      /* swallow */
    }
  }

  if (order.status === "delivered") {
    // Calculate the amount after deducting the 5% commission
    const orderAmount = order?.items[0]?.price;
    const commission = orderAmount * 0.05;
    const amountAfterCommission = orderAmount - commission;

    // Update freelancer's balance with the amount after deducting commission
    const updatedFreelancer = await User.findByIdAndUpdate(
      order.freelancerId,
      { $inc: { balance: amountAfterCommission } },
      { new: true }
    );

    if (!updatedFreelancer) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to update freelancer balance"
      );
    }

    const notificationData = {
      receiverId: order?.freelancerId,
      message: `Your order has been delivered`,
      role: "freelancer",
      type: "order",
      viewStatus: false,
    };

    // Send the notification using addCustomNotification
    await addCustomNotification(
      "order-delivered",
      order?.freelancerId,
      notificationData
    );
  }

  return order;
};

// Seller requests a delivery-date extension. Posts a system message
// into the order chat so the buyer sees Accept/Decline in context.
const requestExtension = async (orderId, sellerId, { newDeliveryDate, reason }) => {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (String(order.freelancerId) !== String(sellerId)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the seller can request an extension");
  }
  if (!["active", "late"].includes(order.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Order is not in a state that allows extension");
  }
  const target = new Date(newDeliveryDate);
  if (!newDeliveryDate || Number.isNaN(target.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, "newDeliveryDate is required");
  }
  if (target <= new Date(order.deliveryDate)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "The new delivery date must be after the original date"
    );
  }
  if (order.extensionRequest?.status === "pending") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "An extension request is already pending — wait for the buyer to respond"
    );
  }

  order.extensionRequest = {
    newDeliveryDate: target,
    reason: String(reason || "").trim().slice(0, 1000),
    status: "pending",
    requestedAt: new Date(),
    respondedAt: null,
  };
  await order.save();

  // Drop a system bubble into the order chat. Lazy-require to avoid a
  // circular import with the orderMessage service.
  const orderMessageService = require("./orderMessage.service");
  const msg = await orderMessageService.addOrderMessage({
    orderId,
    sender: order.freelancerId,
    receiver: order.clientId,
    content: {
      messageType: "extensionRequest",
      message: `Extension requested → new delivery ${target.toDateString()}`,
      extensionDetails: {
        newDeliveryDate: target,
        originalDeliveryDate: order.deliveryDate,
        reason: order.extensionRequest.reason,
        status: "pending",
      },
    },
  });

  // Email the buyer asynchronously.
  try {
    const [buyer, seller, gig] = await Promise.all([
      User.findById(order.clientId).select("fullName email username"),
      User.findById(order.freelancerId).select("fullName email username"),
      order.gigId ? Gig.findById(order.gigId).select("title") : null,
    ]);
    if (buyer?.email) {
      emailService.sendExtensionRequestedBuyer(buyer.email, {
        buyerName: buyer.fullName || buyer.username,
        sellerName: seller?.fullName || seller?.username,
        gigTitle: gig?.title || "your gig",
        orderId: order._id,
        newDeliveryDate: target,
        reason: order.extensionRequest.reason,
      });
    }
  } catch (e) {
    /* swallow */
  }

  return { order, message: msg };
};

// Buyer accepts or declines the seller's extension request. On accept
// we move the order's `deliveryDate`; on decline we keep the original.
// Either way we mark the request resolved and post a system message
// so the chat thread reflects the outcome.
const respondExtension = async (orderId, buyerId, { action }) => {
  if (!["accept", "decline"].includes(action)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "action must be 'accept' or 'decline'");
  }
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (String(order.clientId) !== String(buyerId)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can respond to this request");
  }
  if (order.extensionRequest?.status !== "pending") {
    throw new ApiError(httpStatus.BAD_REQUEST, "No pending extension to respond to");
  }

  const target = new Date(order.extensionRequest.newDeliveryDate);
  if (action === "accept") {
    order.deliveryDate = target;
    order.extensionRequest.status = "accepted";
    // If the order had drifted to "late", the new date may put it back
    // in the "active" window. Recompute lazily.
    if (order.status === "late" && target > new Date()) {
      order.status = "active";
    }
  } else {
    order.extensionRequest.status = "declined";
  }
  order.extensionRequest.respondedAt = new Date();
  await order.save();

  const orderMessageService = require("./orderMessage.service");
  const msg = await orderMessageService.addOrderMessage({
    orderId,
    sender: order.clientId,
    receiver: order.freelancerId,
    content: {
      messageType: "extensionResponse",
      message:
        action === "accept"
          ? `Extension accepted → new delivery ${target.toDateString()}`
          : "Extension declined",
      extensionDetails: {
        newDeliveryDate: target,
        status: order.extensionRequest.status,
        respondedAt: order.extensionRequest.respondedAt,
      },
    },
  });

  // Email the seller asynchronously.
  try {
    const [buyer, seller, gig] = await Promise.all([
      User.findById(order.clientId).select("fullName email username"),
      User.findById(order.freelancerId).select("fullName email username"),
      order.gigId ? Gig.findById(order.gigId).select("title") : null,
    ]);
    if (seller?.email) {
      emailService.sendExtensionResponseSeller(seller.email, {
        sellerName: seller.fullName || seller.username,
        buyerName: buyer?.fullName || buyer?.username,
        gigTitle: gig?.title || "your gig",
        orderId: order._id,
        accepted: action === "accept",
        newDeliveryDate: target,
      });
    }
  } catch (e) {
    /* swallow */
  }

  return { order, message: msg };
};

module.exports = {
  orderCreate,
  getOrders,
  createOrderRequest,
  getMyOrders,
  getOrderById,
  orderModify,
  freelancerOrdersList,
  getOrderCounts,
  requestExtension,
  respondExtension,
};
