// Admin-only read access to platform conversations.
//
// Two flavours of chat live on the marketplace:
//   1. Direct messages — Chat + Message (one-to-one buyer/seller DMs)
//   2. Order chats    — orderMessage (scoped to a Payment._id)
//
// This service exposes paginated lists + full thread reads for both,
// scoped admin-only via the route guard. No writes — moderation only.

const { Chats, Messages, OrderMessage, Payment, RiskFlag } = require("../models");

async function listDirectChats({ search = "", limit = 100, page = 1 } = {}) {
  const items = await Chats.find({ isDeleted: { $ne: true } })
    .sort({ updatedAt: -1 })
    .skip(Math.max(0, (page - 1) * limit))
    .limit(limit)
    .populate({
      path: "participants",
      select: "fullName username email image role online",
    });

  // Attach last message + counts. Cheap because we cap the chat list.
  const data = await Promise.all(
    items.map(async (chat) => {
      const last = await Messages.findOne({ chat: chat._id })
        .sort({ createdAt: -1 })
        .populate({ path: "sender", select: "fullName username role" });
      const count = await Messages.countDocuments({ chat: chat._id });
      const openFlags = await RiskFlag.countDocuments({ kind: "message", chatId: chat._id, status: "open" });
      return { chat, lastMessage: last, messageCount: count, openFlags, flagged: openFlags > 0 };
    })
  );

  // Optional search across participant names / emails.
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? data
    : data.filter((row) =>
        (row.chat.participants || []).some((p) =>
          [p.fullName, p.username, p.email]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(q))
        )
      );

  return { results: filtered, totalResults: filtered.length, page, limit };
}

async function getDirectChat(chatId) {
  const chat = await Chats.findById(chatId).populate({
    path: "participants",
    select: "fullName username email image role online",
  });
  if (!chat) throw new Error("Chat not found");
  const messages = await Messages.find({ chat: chatId })
    .sort({ createdAt: 1 })
    .populate([
      { path: "sender", select: "fullName username email image role" },
      { path: "receiver", select: "fullName username email image role" },
    ]);
  return { chat, messages };
}

async function listOrderChats({ search = "", limit = 100, page = 1 } = {}) {
  // Roll the orderMessage collection up to one row per orderId, sorted
  // by the most recent message.
  const grouped = await OrderMessage.aggregate([
    {
      $group: {
        _id: "$orderId",
        lastAt: { $max: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { lastAt: -1 } },
    { $skip: Math.max(0, (page - 1) * limit) },
    { $limit: limit },
  ]);

  // Hydrate each orderId via Payment (order detail = Payment in the
  // current model layout).
  const rows = await Promise.all(
    grouped.map(async (g) => {
      const order = await Payment.findById(g._id)
        .populate({ path: "clientId", select: "fullName username email image role" })
        .populate({ path: "freelancerId", select: "fullName username email image role" })
        .populate({ path: "gigId", select: "title slug images" });
      const last = await OrderMessage.findOne({ orderId: g._id })
        .sort({ createdAt: -1 })
        .populate({ path: "sender", select: "fullName username image role" });
      return { orderId: g._id, order, lastMessage: last, messageCount: g.count };
    })
  );

  // Search across buyer/seller name + gig title.
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((r) =>
        [
          r.order?.clientId?.fullName,
          r.order?.freelancerId?.fullName,
          r.order?.gigId?.title,
        ]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      );

  return { results: filtered, totalResults: filtered.length, page, limit };
}

async function getOrderChat(orderId) {
  const order = await Payment.findById(orderId)
    .populate({ path: "clientId", select: "fullName username email image role" })
    .populate({ path: "freelancerId", select: "fullName username email image role" })
    .populate({ path: "gigId", select: "title slug images" });
  if (!order) throw new Error("Order not found");
  const messages = await OrderMessage.find({ orderId })
    .sort({ createdAt: 1 })
    .populate([
      { path: "sender", select: "fullName username image role" },
      { path: "receiver", select: "fullName username image role" },
    ]);
  return { order, messages };
}


async function listFlaggedMessages({ status = "open", limit = 50, page = 1 } = {}) {
  const filter = { kind: "message" };
  if (status && status !== "all") filter.status = status;
  const result = await RiskFlag.paginate(filter, {
    sortBy: "createdAt:desc",
    page: Number(page) || 1,
    limit: Math.min(Number(limit) || 50, 200),
    populate: [
      { path: "userId", select: "fullName username email image role" },
      { path: "chatId", select: "participants", populate: { path: "participants", select: "fullName username image role" } },
    ],
  });
  return result;
}

module.exports = {
  listDirectChats,
  getDirectChat,
  listOrderChats,
  getOrderChat,
  listFlaggedMessages,
};

