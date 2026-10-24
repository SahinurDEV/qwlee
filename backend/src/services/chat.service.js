const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const Chat = require("../models/chat.model");
const Message = require("../models/message.model");

// First-message limit: how many new conversations one person can open in
// 24 hours (siteSettings.moderation.newChatsPerDay, 0 = no limit).
const assertCanStartChat = async (userId) => {
  const limit = (await require("./siteSettings.service").get()).moderation.newChatsPerDay;
  if (!limit) return;
  const n = await Chat.countDocuments({ startedBy: userId, createdAt: { $gte: new Date(Date.now() - 86400000) } });
  if (n >= limit) throw new ApiError(httpStatus.TOO_MANY_REQUESTS, `You can start up to ${limit} new conversations a day. Try again tomorrow, or reply in an existing conversation.`);
};

const addChat = async (chatBody) => {
  try {
    return await Chat.create(chatBody);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getChats = async (filter, options, receiver) => {
  try {
    const { limit = 100, page = 1 } = options;

    // Add filter to exclude chats where the receiver is in the deletedBy array
    filter["deletedBy"] = { $nin: [receiver] };

    const count = await Chat.countDocuments(filter);
    const totalPages = Math.ceil(count / limit);
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      ...filter,
      participants: { $eq: receiver },
    })
      .populate({
        path: "participants",
        select: "fullName image role online lastSeen",
        match: { _id: { $ne: receiver } },
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const data = [];
    for (const chatItem of chats) {
      const chatId = chatItem._id;
      // Find the latest message in the chat
      const lastMessage = await Message.findOne({ chat: chatId }).sort({
        createdAt: -1,
      });
      // Empty chats (created by the Contact button but never used)
      // don't belong in the inbox sidebar. The realtime `new-chat`
      // event will surface them the moment the first message lands.
      if (!lastMessage) continue;
      // Unread count for this viewer = messages where they're the
      // receiver and haven't been read yet. Used for the sidebar badge
      // + the global navbar dot.
      const unreadCount = await Message.countDocuments({
        chat: chatId,
        receiver: receiver,
        readed: false,
      });

      data.push({ chat: chatItem, lastMessage, unreadCount });
    }

    const me = String(receiver);
    for (const d of data) {
      d.pinned = (d.chat.pinnedBy || []).map(String).includes(me);
      d.archived = (d.chat.archivedBy || []).map(String).includes(me);
      d.blocked = (d.chat.blockedBy || []).length > 0;
      d.blockedByMe = (d.chat.blockedBy || []).map(String).includes(me);
    }
    // Pinned first, then most recent.
    data.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const dateA = (a.lastMessage && a.lastMessage.createdAt) || 0;
      const dateB = (b.lastMessage && b.lastMessage.createdAt) || 0;
      return dateB - dateA;
    });

    return {
      data,
      totalPages,
      currentPage: page,
      totalChats: data.length,
    };
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getChatById = async (id) => {
  try {
    return await Chat.findById(id).populate({
      path: "participants",
      select: "fullName image role online lastSeen",
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getChat = async (userId, chatId) => {
  try {
    const chat = await Chat.findById(chatId).populate({
      path: "participants",
      select: "fullName image role online lastSeen responseTime availability location",
      match: { _id: { $ne: userId } },
    });
    return chat;
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getChatByParticipants = async (participants) => {
  try {
    return await Chat.findOne({
      $and: [
        { participants: participants[0] },
        { participants: participants[1] },
      ],
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const updateChat = async (chatId, updateBody) => {
  try {
    const chat = await getChatById(chatId);
    if (!chat) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
    }
    Object.assign(chat, updateBody);
    await chat.save();
    return chat;
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getChatByDeleteId = async (chatId, userId) => {
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
    }
    const participantIndex = chat.participants.indexOf(userId);
    if (participantIndex === -1) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User is not a participant in this chat"
      );
    }
    if (chat.deletedBy.includes(userId)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User has already been deleted from this chat"
      );
    }
    chat.deletedBy.push(userId);

    // Update all messages associated with the chat to mark them as deleted by the user
    await Message.updateMany(
      { chat: chatId },
      { $addToSet: { deletedBy: userId } }
    );

    await chat.save();
    return chat;
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

module.exports = {
  assertCanStartChat,
  addChat,
  getChats,
  getChat,
  getChatById,
  getChatByParticipants,
  updateChat,
  getChatByDeleteId,
};
