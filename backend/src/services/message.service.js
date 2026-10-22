const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const Message = require("../models/message.model");
const Payment = require("../models/payment.model");
const { addCustomNotification } = require("./notification.service");
const { User } = require("../models");

const addMessage = async (messageBody) => {
  try {
    return await Message.create(messageBody);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

/** Mark the viewer's inbound messages read and tell the sender(s). */
const markRead = async (chatId, userId) => {
  const unread = await Message.find({ chat: chatId, receiver: userId, readed: false }, { sender: 1 }).lean();
  if (!unread.length) return 0;
  const at = new Date();
  await Message.updateMany({ _id: { $in: unread.map((m) => m._id) } }, { $set: { readed: true, readAt: at } });
  try {
    const { io } = require("../socket/socketServer");
    for (const sender of new Set(unread.map((m) => String(m.sender)))) {
      io.to(sender).emit("messages-read", { chatId: String(chatId), readerId: String(userId), readAt: at });
    }
  } catch { /* socket optional */ }
  return unread.length;
};

const getMessages = async (chatId, options, userId) => {
  try {
    const { limit = 50, page = 1 } = options; // Set default limit and page values
    // Count all messages in the chat
    const count = await Message.countDocuments({
      chat: chatId,
      deletedBy: { $ne: userId }, // Exclude messages marked as deleted by the user
    });

    const totalPages = Math.ceil(count / limit); // Calculate total pages
    const skip = (page - 1) * limit; // Calculate skip value

    // Find messages in the chat excluding those marked as deleted by the user
    const messages = await Message.find({
      chat: chatId,
      deletedBy: { $ne: userId }, // Exclude messages marked as deleted by the user
    })
      .populate([
        { path: "replyTo", select: "message file fileType" },
        { path: "sender", select: "fullName image role online" },
        { path: "receiver", select: "fullName image role online" },
      ])
      .skip(skip)
      .limit(limit);

    // Reading the thread marks the viewer's inbound messages as read.
    // Don't await — the client doesn't need the count back, and the
    // update is idempotent. Failure here shouldn't fail the request.
    // The sender gets a live "seen" receipt.
    markRead(chatId, userId).catch(() => {});

    const result = {
      data: messages,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalResults: count,
    };

    return result;
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getMessage = async (messageId, userId) => {
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
    }

    if (message.deletedBy.includes(userId)) {
      throw new ApiError(httpStatus.FORBIDDEN, "This message has been deleted");
    }

    return message;
  } catch (err) {
    console.error("Error fetching message:", err.message);
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const updateMessageStatus = async (messageId, newStatus, orderId) => {
  try {
    // Validate the new status
    const validStatuses = ["pending", "accepted", "rejected"];
    if (!validStatuses.includes(newStatus)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status provided");
    }

    // Build the update object
    const updateFields = {
      "content.offerDetails.status": newStatus,
    };

    // Conditionally add orderId if it exists
    if (orderId) {
      updateFields["content.offerDetails.orderId"] = orderId;
    }

    // Find the message and update the offerDetails
    const message = await Message.findOneAndUpdate(
      { _id: messageId, "content.offerDetails": { $exists: true } },
      {
        $set: updateFields,
      },
      { new: true }
    );

    if (!message) {
      throw new ApiError(httpStatus.NOT_FOUND, "Message or offer not found");
    }

    // If the orderId exists, find the order and send a notification
    if (orderId) {
      const order = await Payment.findById(orderId);

      if (order) {
        // Retrieve client and freelancer details
        const client = await User.findById(order.clientId).select("username");
        const clientName = client ? client?.username : "Unknown Client";
        const freelancerId = order.freelancerId;

        // Build notification data
        const notificationData = {
          receiverId: freelancerId,
          message: `Your offer has been ${newStatus} by ${clientName}`,
          role: "freelancer",
          type: "order",
          viewStatus: false,
        };

        // Send the notification using addCustomNotification
        await addCustomNotification(
          "order-status-updated",
          freelancerId,
          notificationData
        );
      }
    }

    return message;
  } catch (err) {
    console.error("Error updating message status:", err.message);
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const cancelAndWithdrawOfferMessage = async (messageId, userId) => {
  const user = await User.findById(userId);
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
    }
    message.content.offerDetails.status = "rejected";
    await message.save();

    if (user.role === "buyer") {
      // Build notification data
      const notificationData = {
        receiverId: message?.content?.offerDetails?.freelancerId,
        message: `Your offer has been canceled`,
        role: "freelancer",
        type: "order",
        viewStatus: false,
      };
      // Send the notification using addCustomNotification
      await addCustomNotification(
        "order-status-updated",
        message?.content?.offerDetails?.freelancerId,
        notificationData
      );
    }
    return message;
  } catch (err) {
    console.error(
      "Error cancelling and withdrawing offer message:",
      err.message
    );
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const deleteMessage = async (messageId, userId) => {
  console.log("messageId", messageId, userId);
  const message = await Message.findById(messageId);
  console.log("message", message);
  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }

  //  if(message.sender != userId){
  //    throw new ApiError(httpStatus.BAD_REQUEST, "This is not your message");
  //  }
  if (message.deletedBy.includes(userId)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User has already been deleted from this chat"
    );
  }
  message.deletedBy.push(userId);

  await message.save();
  return message;
};

const getMessageByChatId = async (id) => {
  try {
    const message = await Message.find({ chat: id });
    return message;
  } catch (err) {
    logger.error(err, "from: get all message");
    console.error(err);
    return null;
  }
};

module.exports = {
  markRead,
  addMessage,
  getMessages,
  deleteMessage,
  updateMessageStatus,
  getMessage,
  getMessageByChatId,
  cancelAndWithdrawOfferMessage,
};
