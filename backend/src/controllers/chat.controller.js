const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { chatService } = require("../services");
const { assertChatMember } = require("../utils/access");
const response = require("../config/response");

const addChat = catchAsync(async (req, res) => {
  const senderId = req.user.id;
  const receiverId = req.body.receiverId;
  const participants = [senderId, receiverId];
  const existingChat = await chatService.getChatByParticipants(participants);
  if (existingChat) {
    return res.status(httpStatus.CREATED).json(
      response({
        message: "Chat already exists",
        status: "OK",
        statusCode: httpStatus.OK,
        data: existingChat,
      })
    );
  }
  const chatBody = { participants: participants };
  const chat = await chatService.addChat(chatBody);
  return res.status(httpStatus.CREATED).json(
    response({
      message: "Chat created successful",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: chat,
    })
  );
});

const getChats = catchAsync(async (req, res) => {
  const receiver = req.user.id;
  const options = pick(req.query, ["createdAt", "limit", "page"]);
  // Blocked chats stay in the list so the blocker can unblock them.
  const filter = { participants: { $in: [req.user.id] } };
  const chatResult = await chatService.getChats(filter, options, receiver);

  res.status(httpStatus.OK).json(
    response({
      code: httpStatus.OK,
      message: "Chat successfully retrieved",
      data: chatResult,
    })
  );
});

const getChat = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const chat = await chatService.getChat(userId, chatId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Chat retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: chat,
    })
  );
});

// Block or unblock a conversation. Only its participants may do this.
// Body: { action: "block" | "unblock" } (legacy: { status: "blocked" }).
const updateChat = catchAsync(async (req, res) => {
  await assertChatMember(req.params.chatId, req.user.id);
  const chat = await chatService.getChatById(req.params.chatId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }
  const me = String(req.user.id);
  let action = req.body?.action;
  if (!action && req.body?.status === "blocked") action = "block";
  if (!action && req.body?.status === "accepted") action = "unblock";
  if (!["block", "unblock"].includes(action)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "action must be block or unblock");
  }
  const list = (chat.blockedBy || []).map(String).filter((id) => id !== me);
  if (action === "block") list.push(me);
  chat.blockedBy = list;
  chat.status = list.length ? "blocked" : "accepted";
  await chat.save();
  res.status(httpStatus.OK).json(
    response({
      message: action === "block" ? "Conversation blocked" : "Conversation unblocked",
      status: "OK",
      statusCode: httpStatus.OK,
      data: chat,
    })
  );
});

const deleteChat = catchAsync(async (req, res) => {
  const chat = await chatService.getChatByDeleteId(
    req.body.chatId,
    req.user.id
  );
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Chat deleted successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: chat,
    })
  );
});

module.exports = {
  getChats,
  deleteChat,
  updateChat,
  addChat,
  getChat, // Export the new getChat function
};
