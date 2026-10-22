const { assertOrderParty } = require("../utils/access");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const orderMessageService = require("../services/orderMessage.service");
const { io } = require("../socket/socketServer");

const getFileTypeFromMimetype = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("application/")) return "application";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown"; // Default if the type is not recognized
};

// const addOrderMessage = catchAsync(async (req, res, next) => {
//   const sender = req.user.id;
//   const { message, receiver, orderId, deliveryMessage } = req.body;

//   console.log(req.files);

//   let deliveryDetails = {};
//   if (deliveryMessage) {
//     deliveryDetails.message = deliveryMessage;
//     deliveryDetails.files = req.files.map((file) => ({
//       path: `/uploads/orderMessage/${file.filename}`,
//       fileType: getFileTypeFromMimetype(file.mimetype),
//     }));
//   }

//   // Prepare message content
//   const newMessage = {
//     orderId,
//     content: {
//       messageType: deliveryDetails
//         ? "deliveryMessage"
//         : req.files?.length > 0
//         ? getFileTypeFromMimetype(req.files[0].mimetype)
//         : "text",
//       message: message || "",
//       files:
//         deliveryDetails && req.files
//           ? []
//           : req.files?.map((file) => ({
//               path: `/uploads/orderMessage/${file.filename}`,
//               fileType: getFileTypeFromMimetype(file.mimetype),
//             })),
//       deliveryDetails: deliveryDetails || {}, // Adding delivery details if provided
//     },
//     sender,
//     receiver,
//   };

//   // Send and save the message
//   const messageSent = await orderMessageService.addOrderMessage(newMessage);
//   if (messageSent) {
//     const newMessageData = await orderMessageService.getMessage(
//       messageSent?._id
//     );
//     io.to(receiver).emit("new-order-message", newMessageData);
//     res.status(httpStatus.CREATED).json(
//       response({
//         message: "Order message added successfully",
//         status: "OK",
//         statusCode: httpStatus.CREATED,
//         data: messageSent,
//       })
//     );
//   } else {
//     throw new ApiError(httpStatus.BAD_REQUEST, "Something went wrong");
//   }
// });

const addOrderMessage = catchAsync(async (req, res, next) => {
  const sender = req.user.id;
  const { message, receiver, orderId, deliveryMessage } = req.body;
  const partyOrder = await assertOrderParty(orderId, sender);
  const otherParty = [String(partyOrder.clientId), String(partyOrder.freelancerId)].find((id) => id !== String(sender));
  if (receiver && String(receiver) !== otherParty) {
    throw new ApiError(httpStatus.FORBIDDEN, "Receiver is not on this order");
  }

  // A delivery is a state change, not just a chat message: only the
  // seller may deliver, and only on an open order.
  if (deliveryMessage) {
    await require("../services/orderLifecycle.service").recordDelivery(orderId, sender);
  }

  let deliveryDetails = null;
  let messageType = "text";
  let files = [];

  // If there are files attached, determine their type and add them to the files array
  if (req.files?.length > 0) {
    files = req.files.map((file) => ({
      path: file.cloudUrl,
      fileType: getFileTypeFromMimetype(file.mimetype),
    }));
    messageType = getFileTypeFromMimetype(req.files[0].mimetype);
  }

  // If a delivery message is provided, prepare delivery details
  if (deliveryMessage) {
    deliveryDetails = {
      message: deliveryMessage,
      files, // Assign the files array to deliveryDetails
    };
    messageType = "deliveryMessage";
    files = []; // Reset the files array in content if using delivery details
  }

  // Prepare message content
  const newMessage = {
    orderId,
    content: {
      messageType,
      message: message || "",
      files: files, // Use the files array if not a delivery message
      deliveryDetails: deliveryDetails || {},
    },
    sender,
    receiver,
  };

  // Send and save the message
  const messageSent = await orderMessageService.addOrderMessage(newMessage);
  if (messageSent) {
    const newMessageData = await orderMessageService.getMessage(
      messageSent?._id
    );
    io.to(receiver).emit("new-order-message", newMessageData);

    // If this was a delivery, ping the buyer by email — they may not
    // be in the order page when the seller delivers.
    if (deliveryMessage) {
      try {
        const emailService = require("../services/email.service");
        const { Payment, Gig, User } = require("../models");
        const order = await Payment.findById(orderId);
        const [buyer, sellerUser, gig] = await Promise.all([
          User.findById(order?.clientId).select("fullName email username"),
          User.findById(order?.freelancerId).select("fullName email username"),
          order?.gigId ? Gig.findById(order.gigId).select("title") : null,
        ]);
        if (buyer?.email) {
          emailService.sendOrderDeliveredBuyer(buyer.email, {
            buyerName: buyer.fullName || buyer.username,
            sellerName: sellerUser?.fullName || sellerUser?.username,
            gigTitle: gig?.title || "your gig",
            orderId: order?._id,
            message: deliveryMessage,
          });
        }
      } catch (e) {
        /* email failures don't block messaging */
      }
    }
    res.status(httpStatus.CREATED).json(
      response({
        message: "Order message added successfully",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: messageSent,
      })
    );
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Something went wrong");
  }
});

const getOrderMessages = catchAsync(async (req, res, next) => {
  const orderId = req.query.orderId;
  const options = pick(req.query, ["limit", "page", "sortBy"]);

  // Validate required parameters
  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Order  ID is required.");
  }
  await assertOrderParty(orderId, req.user.id);
  // Fetch messages
  const result = await orderMessageService.getOrderMessages(orderId, options);
  res.status(httpStatus.OK).json(
    response({
      message: "Order messages fetched successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

module.exports = {
  addOrderMessage,
  getOrderMessages,
};
