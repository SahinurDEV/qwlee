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
  // ?archived=true lists archived conversations; the default hides them.
  filter.archivedBy = req.query.archived === "true" ? req.user.id : { $ne: req.user.id };
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
  await assertChatMember(chatId, userId);
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

// Per-user conversation actions. Only participants may do this.
// Body: { action } where action is one of
//   block | unblock | archive | unarchive | pin | unpin
// (legacy: { status: "blocked" } means block).
const LIST_FOR = { block: "blockedBy", unblock: "blockedBy", archive: "archivedBy", unarchive: "archivedBy", pin: "pinnedBy", unpin: "pinnedBy" };
const ADDS = new Set(["block", "archive", "pin"]);
const DONE = { block: "Conversation blocked", unblock: "Conversation unblocked", archive: "Conversation archived", unarchive: "Conversation moved to inbox", pin: "Conversation pinned", unpin: "Conversation unpinned" };
const updateChat = catchAsync(async (req, res) => {
  await assertChatMember(req.params.chatId, req.user.id);
  const { Chats: Chat } = require("../models");
  const chat = await Chat.findById(req.params.chatId);
  if (!chat) {
    throw new ApiError(httpStatus.NOT_FOUND, "Chat not found");
  }
  const me = String(req.user.id);
  let action = req.body?.action;
  if (!action && req.body?.status === "blocked") action = "block";
  if (!action && req.body?.status === "accepted") action = "unblock";
  const field = LIST_FOR[action];
  if (!field) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Unknown action");
  }
  const list = (chat[field] || []).map(String).filter((id) => id !== me);
  if (ADDS.has(action)) list.push(me);
  chat[field] = list;
  if (field === "blockedBy") chat.status = list.length ? "blocked" : "accepted";
  // Pinning an archived chat brings it back to the inbox.
  if (action === "pin") chat.archivedBy = (chat.archivedBy || []).map(String).filter((id) => id !== me);
  await chat.save();
  res.status(httpStatus.OK).json(
    response({
      message: DONE[action],
      status: "OK",
      statusCode: httpStatus.OK,
      data: chat,
    })
  );
});

// Report the other member of a conversation. Opens a "chat" flag in the
// admin Risk flags queue; optionally blocks the chat at the same time.
const REPORT_REASONS = ["spam", "scam", "off-platform", "harassment", "inappropriate", "other"];
const reportChat = catchAsync(async (req, res) => {
  const chat = await assertChatMember(req.params.chatId, req.user.id);
  const reason = String(req.body?.reason || "");
  if (!REPORT_REASONS.includes(reason)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `reason must be one of: ${REPORT_REASONS.join(", ")}`);
  }
  const note = String(req.body?.note || "").slice(0, 500);
  const other = chat.participants.map(String).find((id) => id !== String(req.user.id));
  const { RiskFlag, Chats: Chat } = require("../models");
  const open = await RiskFlag.findOne({ kind: "chat", targetId: String(chat._id), reportedBy: req.user.id, status: "open" });
  if (open) {
    throw new ApiError(httpStatus.CONFLICT, "You already reported this conversation. Our team is looking at it.");
  }
  const flag = await RiskFlag.create({
    kind: "chat",
    targetId: String(chat._id),
    userId: other || null,
    reportedBy: req.user.id,
    reasons: [`report:${reason}`],
    excerpt: note,
    score: 3,
  });
  if (req.body?.block) {
    const c = await Chat.findById(chat._id);
    const list = (c.blockedBy || []).map(String).filter((id) => id !== String(req.user.id));
    list.push(String(req.user.id));
    c.blockedBy = list;
    c.status = "blocked";
    await c.save();
  }
  res.status(httpStatus.CREATED).json(
    response({ message: "Thanks. Our team will review this conversation.", status: "OK", statusCode: httpStatus.CREATED, data: { id: flag.id } })
  );
});

// Orders between the two members, newest first: the chat header shows the
// open one as a pinned context card.
const chatContext = catchAsync(async (req, res) => {
  const chat = await assertChatMember(req.params.chatId, req.user.id);
  const [a, b] = chat.participants;
  const { Payment } = require("../models");
  const orders = await Payment.find({
    isDeleted: { $ne: true },
    $or: [
      { clientId: a, freelancerId: b },
      { clientId: b, freelancerId: a },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate({ path: "gigId", select: "title slug images" })
    .lean();
  const results = orders.map((o) => ({
    id: String(o._id),
    status: o.status,
    price: o.price,
    deliveryDate: o.deliveryDate,
    createdAt: o.createdAt,
    role: String(o.clientId) === String(req.user.id) ? "buyer" : "seller",
    gig: o.gigId ? { id: String(o.gigId._id), title: o.gigId.title, slug: o.gigId.slug, image: o.gigId.images?.[0] || null } : null,
  }));
  const other = chat.participants.map(String).find((id) => id !== String(req.user.id));
  const responseTime = other ? await require("../services/message.service").responseStats(other) : null;
  res.status(httpStatus.OK).json(response({ message: "Chat context", status: "OK", statusCode: httpStatus.OK, data: { orders: results, responseTime } }));
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
  reportChat,
  chatContext,
  getChats,
  deleteChat,
  updateChat,
  addChat,
  getChat, // Export the new getChat function
};
