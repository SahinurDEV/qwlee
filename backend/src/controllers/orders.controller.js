const httpStatus = require("http-status");
const logger = require("../config/logger");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const { ordersService } = require("../services");
const orderLifecycle = require("../services/orderLifecycle.service");
const { Payment, User } = require("../models");
const mongoose = require("mongoose");
const messageService = require("../services/message.service");
const notificationService = require("../services/notification.service");
const emailService = require("../services/email.service");
const { Gig } = require("../models");
// Checkout. Prices are computed on the server from the gig package and
// extras (or the seller's custom offer); anything price-like in the
// request body is ignored. Pays with Stripe when configured, otherwise
// with the built-in demo provider when DEMO_PAYMENTS=true.
const checkoutBody = (req) => ({
  buyerId: req.user.id,
  gigId: req.body.gigId,
  packageName: req.body.packageName,
  extraIds: Array.isArray(req.body.extraIds) ? req.body.extraIds : [],
  messageId: req.body.messageId || undefined,
  requestOfferId: req.body.requestOfferId || undefined,
});

const orderQuote = catchAsync(async (req, res) => {
  const quote = await orderLifecycle.quoteCheckout(checkoutBody(req));
  res.status(httpStatus.OK).json(
    response({ message: "Quote", status: "OK", statusCode: httpStatus.OK, data: { items: quote.items, total: quote.total, deliveryDays: quote.deliveryDays } })
  );
});

const orderCreate = catchAsync(async (req, res) => {
  if (req.user.role !== "buyer" && req.user.role !== "freelancer") {
    throw new ApiError(httpStatus.FORBIDDEN, "Only marketplace users can place orders");
  }
  const quote = await orderLifecycle.quoteCheckout(checkoutBody(req));
  const frontend = process.env.FRONTEND_URL || "http://localhost:8000";

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (stripeSecret) {
    const stripeClient = require("stripe")(stripeSecret);
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: quote.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      // Only identifiers travel through Stripe; the webhook re-quotes.
      metadata: {
        buyerId: String(req.user.id),
        gigId: quote.gigId || "",
        packageName: quote.packageName || "",
        extraIds: (quote.extraIds || []).join(","),
        messageId: quote.messageId || "",
        requestOfferId: quote.requestOfferId || "",
        freelancerId: quote.freelancerId,
        clientId: String(req.user.id),
      },
      success_url: `${frontend}/success`,
      cancel_url: `${frontend}/cancel`,
    });
    return res.status(200).send({ url: session.url, provider: "stripe" });
  }

  if (process.env.DEMO_PAYMENTS === "true") {
    const crypto = require("crypto");
    const order = await orderLifecycle.createOrderFromQuote(quote, {
      sessionId: `demo_${crypto.randomUUID()}`,
      provider: "demo",
    });
    await notifyNewOrder(order);
    return res.status(200).send({
      url: `${frontend}/order/${order._id}?placed=1`,
      orderId: order._id,
      provider: "demo",
    });
  }

  throw new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "Payments are not configured. Set STRIPE_SECRET_KEY, or DEMO_PAYMENTS=true for a demo."
  );
});

const orderTip = catchAsync(async (req, res) => {
  const { order, amount } = await orderLifecycle.quoteTip(req.params.orderId, req.user.id, Number(req.body?.amount));
  const frontend = process.env.FRONTEND_URL || "http://localhost:8000";
  if (process.env.STRIPE_SECRET_KEY) {
    const stripeClient = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{ price_data: { currency: "usd", product_data: { name: `Tip for order ${order._id}` }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
      metadata: { kind: "tip", orderId: String(order._id), buyerId: String(req.user.id), amount: String(amount) },
      success_url: `${frontend}/order/${order._id}?tipped=1`,
      cancel_url: `${frontend}/order/${order._id}`,
    });
    return res.status(200).send({ url: session.url, provider: "stripe" });
  }
  if (process.env.DEMO_PAYMENTS === "true") {
    const crypto = require("crypto");
    await orderLifecycle.recordTip(order._id, amount, { provider: "demo", sessionId: `demo_tip_${crypto.randomUUID()}` });
    Promise.resolve()
      .then(() => notificationService.addCustomNotification("freelancer-notification", order.freelancerId, {
        receiverId: order.freelancerId,
        message: `You received a $${amount} tip.`,
        role: "freelancer",
        type: "payment",
        viewStatus: false,
      }))
      .catch(() => null);
    return res.status(200).send({ url: `${frontend}/order/${order._id}?tipped=1`, provider: "demo" });
  }
  throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Payments are not configured");
});

// Notifications + confirmation emails for a newly paid order. Never throws.
const notifyNewOrder = async (order) => {
  try {
    const [buyer, seller, gig] = await Promise.all([
      User.findById(order.clientId).select("fullName email username"),
      User.findById(order.freelancerId).select("fullName email username"),
      order.gigId ? Gig.findById(order.gigId).select("title") : null,
    ]);
    await notificationService.addCustomNotification("freelancer-notification", order.freelancerId, {
      receiverId: order.freelancerId,
      message: `You have a new order from ${buyer?.username || buyer?.fullName || "a buyer"}.`,
      role: "freelancer",
      type: "order",
      viewStatus: false,
    });
    const ctx = {
      buyerName: buyer?.fullName || buyer?.username || "there",
      sellerName: seller?.fullName || seller?.username || "your seller",
      gigTitle: gig?.title || order?.data?.title || "your gig",
      orderId: order._id,
      price: order.price,
      deliveryDate: order.deliveryDate,
    };
    if (buyer?.email) emailService.sendOrderConfirmedBuyer(buyer.email, ctx);
    if (seller?.email) emailService.sendOrderConfirmedSeller(seller.email, ctx);
  } catch (e) {
    logger.warn(`new-order notifications failed: ${e.message}`);
  }
};

const orderPlaced = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    let event;

    if (!endpointSecret) {
      throw new Error("Stripe webhook secret not configured.");
    }

    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);

    const data = event.data.object;
    const eventType = event.type;


    switch (eventType) {
      case "checkout.session.completed": {
        const session = await stripe.checkout.sessions.retrieve(data.id);
        const md = session.metadata || {};
        if (md.kind === "tip") {
          const { amount } = await orderLifecycle.quoteTip(md.orderId, md.buyerId, Number(md.amount));
          if (Math.round(amount * 100) !== Number(session.amount_total)) throw new Error(`Tip amount mismatch for ${session.id}`);
          await orderLifecycle.recordTip(md.orderId, amount, { provider: "stripe", sessionId: session.id });
          break;
        }
        // Re-price on the server and make sure Stripe charged that amount.
        const quote = await orderLifecycle.quoteCheckout({
          buyerId: md.buyerId || md.clientId,
          gigId: md.gigId || undefined,
          packageName: md.packageName || undefined,
          extraIds: md.extraIds ? md.extraIds.split(",").filter(Boolean) : [],
          messageId: md.messageId || undefined,
          requestOfferId: md.requestOfferId || undefined,
        });
        if (Math.round(quote.total * 100) !== Number(session.amount_total)) {
          throw new Error(`Amount mismatch for session ${session.id}`);
        }
        const order = await orderLifecycle.createOrderFromQuote(quote, {
          sessionId: session.id,
          provider: "stripe",
        });
        await notifyNewOrder(order);
        break;
      }
      default:
        // Handle other webhook events or errors as needed
    }

    res.send().end();
  } catch (err) {
    logger.warn(`Stripe webhook error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

const createOrderRequest = catchAsync(async (req, res) => {
  const order = await ordersService.createOrderRequest(req.body);
  res.status(httpStatus.CREATED).json(
    response({
      message: "Order Request Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: order,
    })
  );
});

const getOrders = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["name", "status", "gender"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await ordersService.getOrders(filter, options, req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "All Orders",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getOrderById = catchAsync(async (req, res) => {
  const order = await ordersService.getOrderById(req.params.orderId);
  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }
  const uid = String(req.user?.id);
  const partyIds = [order.clientId?._id || order.clientId, order.freelancerId?._id || order.freelancerId].map(String);
  if (!partyIds.includes(uid)) {
    // Do not reveal whether the order exists.
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Order",
      status: "OK",
      statusCode: httpStatus.OK,
      data: order,
    })
  );
});
const getMyOrders = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["name", "status", "gender"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await ordersService.getMyOrders(filter, options, req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "All Orders",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const orderModify = catchAsync(async (req, res) => {
  const userId = req?.user?.id;
  const order = await ordersService.orderModify(
    req.query.orderId,
    req.body,
    userId
  );
  res.status(httpStatus.CREATED).json(
    response({
      message: "Order Modify",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: order,
    })
  );
});

const freelancerOrdersList = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["name", "status", "gender"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await ordersService.freelancerOrdersList(
    filter,
    options,
    req.user.id
  );
  res.status(httpStatus.OK).json(
    response({
      message: "All Orders",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getOrderCounts = catchAsync(async (req, res) => {
  const role = req.query.role === "seller" ? "seller" : "buyer";
  const counts = await ordersService.getOrderCounts(req.user.id, role);
  res.status(httpStatus.OK).json(
    response({
      message: "Order Counts",
      status: "OK",
      statusCode: httpStatus.OK,
      data: counts,
    })
  );
});

const myTotalIncome = catchAsync(async (req, res) => {
  const freelancerId = req.user.id;

  const result = await Payment.aggregate([
    {
      $match: {
        freelancerId: new mongoose.Types.ObjectId(freelancerId),
        status: "completed",
        isDeleted: false,
      },
    },
    {
      $unwind: "$items",
    },
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: { $multiply: ["$items.price", "$items.quantity"] },
        },
      },
    },
  ]);

  const totalIncome = result.length > 0 ? result[0].totalIncome : 0;

  res.status(200).json({
    success: true,
    totalIncome,
  });
});

const requestExtension = catchAsync(async (req, res) => {
  const result = await ordersService.requestExtension(
    req.params.orderId,
    req.user.id,
    req.body
  );
  res.status(httpStatus.CREATED).json(
    response({
      message: "Extension requested",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: result,
    })
  );
});

const respondExtension = catchAsync(async (req, res) => {
  const result = await ordersService.respondExtension(
    req.params.orderId,
    req.user.id,
    req.body
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Extension response recorded",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const submitRequirements = catchAsync(async (req, res) => {
  const order = await orderLifecycle.submitRequirements(req.params.orderId, req.user.id, req.body.answers);
  await notificationService.addCustomNotification("freelancer-notification", order.freelancerId, {
    receiverId: order.freelancerId, message: "The buyer submitted the order requirements. The clock has started.", role: "freelancer", type: "order", viewStatus: false,
  }).catch(() => {});
  res.status(httpStatus.OK).json(response({ message: "Requirements submitted", status: "OK", statusCode: httpStatus.OK, data: order }));
});

const requestRevision = catchAsync(async (req, res) => {
  const order = await orderLifecycle.requestRevision(req.params.orderId, req.user.id, req.body.reason);
  await notificationService.addCustomNotification("freelancer-notification", order.freelancerId, {
    receiverId: order.freelancerId, message: "The buyer requested a revision on your delivery.", role: "freelancer", type: "order", viewStatus: false,
  }).catch(() => {});
  res.status(httpStatus.OK).json(response({ message: "Revision requested", status: "OK", statusCode: httpStatus.OK, data: order }));
});

const acceptDelivery = catchAsync(async (req, res) => {
  const order = await ordersService.orderModify(req.params.orderId, { status: "delivered" }, req.user.id);
  res.status(httpStatus.OK).json(response({ message: "Order completed", status: "OK", statusCode: httpStatus.OK, data: order }));
});

module.exports = {
  orderTip,
  orderQuote,
  submitRequirements,
  requestRevision,
  acceptDelivery,
  orderCreate,
  getOrders,
  createOrderRequest,
  requestExtension,
  respondExtension,
  orderPlaced,
  getMyOrders,
  orderModify,
  getOrderById,
  freelancerOrdersList,
  myTotalIncome,
  getOrderCounts,
};
