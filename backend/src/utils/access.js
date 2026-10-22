const httpStatus = require("http-status");
const ApiError = require("./ApiError");

// Throws 404 unless `userId` is the buyer or seller on the order.
const assertOrderParty = async (orderId, userId) => {
  const { Payment } = require("../models");
  const order = await Payment.findById(orderId).select("clientId freelancerId");
  if (
    !order ||
    ![String(order.clientId), String(order.freelancerId)].includes(String(userId))
  ) {
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }
  return order;
};

// Throws 404 unless `userId` is a participant in the chat.
const assertChatMember = async (chatId, userId) => {
  const { Chats: Chat } = require("../models");
  const chat = await Chat.findById(chatId).select("participants");
  if (!chat || !chat.participants.map(String).includes(String(userId))) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }
  return chat;
};

module.exports = { assertOrderParty, assertChatMember };
