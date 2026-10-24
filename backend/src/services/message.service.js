const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const Message = require("../models/message.model");
const Payment = require("../models/payment.model");
const { addCustomNotification } = require("./notification.service");
const { User } = require("../models");

// Throws 404 unless the user sent or received the message.
const assertParty = (message, userId) => {
  if (
    !message ||
    ![String(message.sender), String(message.receiver)].includes(String(userId))
  ) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
  }
};

const PARTY = "fullName image role online";
const POPULATE = [
  { path: "replyTo", select: "content.messageType content.message content.files sender deletedForEveryone", populate: { path: "sender", select: "fullName" } },
  { path: "sender", select: PARTY },
  { path: "receiver", select: PARTY },
];

// Wiped messages keep their place in the thread but lose their content.
const mask = (m) => {
  const o = typeof m.toJSON === "function" ? m.toJSON() : m;
  if (o.deletedForEveryone) {
    o.content = { messageType: "text", message: "", files: [] };
  }
  if (o.replyTo && o.replyTo.deletedForEveryone) {
    o.replyTo.content = { messageType: "text", message: "", files: [] };
  }
  return o;
};

const loadForClient = async (id) => {
  const m = await Message.findById(id).populate(POPULATE);
  return m ? mask(m) : null;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchMessages = async (userId, q, chatId) => {
  const filter = {
    $or: [{ sender: userId }, { receiver: userId }],
    deletedBy: { $ne: userId },
    deletedForEveryone: { $ne: true },
    "content.message": { $regex: escapeRe(q), $options: "i" },
  };
  if (chatId) filter.chat = chatId;
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(50).populate(POPULATE.slice(1));
  return rows.map(mask);
};

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
    // Page 1 is the most recent messages; each page is returned oldest
    // first so the thread reads top to bottom.
    const rows = await Message.find({
      chat: chatId,
      deletedBy: { $ne: userId }, // Exclude messages marked as deleted by the user
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate(POPULATE);
    const messages = rows.reverse().map(mask);

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
    assertParty(message, userId);

    if (message.deletedBy.map(String).includes(String(userId))) {
      throw new ApiError(httpStatus.FORBIDDEN, "This message has been deleted");
    }

    return message;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const updateMessageStatus = async (messageId, newStatus, orderId, userId) => {
  // Called from the API (userId set): only the buyer the offer was sent
  // to may decline it. Offers become "accepted" only by paying for them
  // (orderLifecycle), never through this endpoint.
  if (userId !== undefined) {
    const existing = await Message.findById(messageId);
    assertParty(existing, userId);
    if (newStatus !== "rejected") {
      throw new ApiError(httpStatus.FORBIDDEN, "Offers are accepted by placing the order");
    }
    if (String(existing.receiver) !== String(userId)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can decline this offer");
    }
    if (existing.content?.offerDetails?.status !== "pending") {
      throw new ApiError(httpStatus.BAD_REQUEST, "This offer is no longer pending");
    }
  }
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
    assertParty(message, userId);
    if (!message.content?.offerDetails || message.content.offerDetails.status !== "pending") {
      throw new ApiError(httpStatus.BAD_REQUEST, "This offer is no longer pending");
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
    if (err instanceof ApiError) throw err;
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const deleteMessage = async (messageId, userId, scope = "me") => {
  const message = await Message.findById(messageId);
  assertParty(message, userId);
  if (scope === "everyone") {
    if (String(message.sender) !== String(userId)) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own messages for everyone.");
    }
    if (message.content?.messageType === "offer") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Withdraw the offer instead of deleting it.");
    }
    if (message.deletedForEveryone) return message;
    message.deletedForEveryone = true;
    message.deletedAt = new Date();
    message.content = { messageType: "text", message: "", files: [] };
    await message.save();
    notifyUpdate(message);
    return message;
  }

  //  if(message.sender != userId){
  //    throw new ApiError(httpStatus.BAD_REQUEST, "This is not your message");
  //  }
  if (message.deletedBy.map(String).includes(String(userId))) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User has already been deleted from this chat"
    );
  }
  message.deletedBy.push(userId);

  await message.save();
  return message;
};

// Tell both sides a message changed (deleted, edited, reacted to).
const notifyUpdate = (message) => {
  try {
    const { io } = require("../socket/socketServer");
    loadForClient(message._id).then((m) => {
      for (const u of [message.sender, message.receiver]) io.to(String(u)).emit("message-updated", m);
    }).catch(() => {});
  } catch { /* socket optional */ }
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
  loadForClient,
  searchMessages,
  notifyUpdate,
  mask,
  markRead,
  addMessage,
  getMessages,
  deleteMessage,
  updateMessageStatus,
  getMessage,
  getMessageByChatId,
  cancelAndWithdrawOfferMessage,
};
