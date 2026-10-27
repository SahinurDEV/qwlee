// Support-ticket service.
//
// Owns the ticket + message bookkeeping (unread counters, lastMessageAt,
// status auto-flips). Controllers stay thin and just translate between
// HTTP and these calls.

const mongoose = require("mongoose");
const { SupportTicket, SupportMessage, User, Payment } = require("../models");

async function createTicket({ userId, subject, category, body }) {
  if (!userId) throw new Error("userId required");
  if (!subject || !body) throw new Error("subject and body required");

  const ticket = await SupportTicket.create({
    userId,
    participants: [userId],
    openedBy: userId,
    openedByRole: "user",
    subject: String(subject).slice(0, 200),
    category: category || "other",
    status: "open",
    unreadByAdmin: 1,
    unreadByUser: 0,
    lastMessageAt: new Date(),
  });
  await SupportMessage.create({
    ticketId: ticket._id,
    senderId: userId,
    senderRole: "user",
    body: String(body).slice(0, 4000),
  });
  return ticket;
}

// Admin-initiated ticket. Either:
//   - provide `orderId` → both buyer + seller are added as participants
//   - provide `participantIds` explicitly → those users become participants
// The admin becomes `openedBy`. The initial message is recorded as an
// `admin` send so both participants see it as coming from support.
async function adminCreateTicket({
  adminId,
  orderId,
  participantIds,
  subject,
  body,
  category = "orders",
  reason = "",
}) {
  if (!adminId) throw new Error("adminId required");
  if (!subject || !body) throw new Error("subject and body required");

  let resolved = Array.isArray(participantIds) ? [...participantIds] : [];
  let resolvedOrderId = orderId || null;

  if (orderId) {
    const order = await Payment.findById(orderId).select(
      "clientId freelancerId items"
    );
    if (!order) throw new Error("Order not found");
    if (order.clientId) resolved.push(order.clientId);
    if (order.freelancerId) resolved.push(order.freelancerId);
  }

  // De-duplicate participants + filter out the admin (the admin
  // doesn't need to be listed as a "user-side" participant — they
  // already have admin-wide ticket access).
  const unique = Array.from(
    new Set(resolved.filter(Boolean).map((id) => String(id)))
  ).filter((id) => String(id) !== String(adminId));

  if (unique.length === 0) {
    throw new Error(
      "No participants resolved — pass orderId or participantIds with at least one user"
    );
  }

  const ticket = await SupportTicket.create({
    // userId stays for back-compat (legacy code may read .userId).
    // Point it at the first participant so existing queries still work.
    userId: unique[0],
    participants: unique,
    openedBy: adminId,
    openedByRole: "admin",
    orderId: resolvedOrderId,
    reason: String(reason || "").slice(0, 500),
    subject: String(subject).slice(0, 200),
    category,
    status: "open",
    // Admin opened it AND wrote the first message → users have it
    // unread, admin already saw their own message.
    unreadByAdmin: 0,
    unreadByUser: 1,
    lastMessageAt: new Date(),
  });

  await SupportMessage.create({
    ticketId: ticket._id,
    senderId: adminId,
    senderRole: "admin",
    body: String(body).slice(0, 4000),
  });

  // Fire-and-forget email to every participant so they see the ticket
  // immediately even if they're not currently on the platform.
  try {
    const emailService = require("./email.service");
    const users = await User.find({ _id: { $in: unique } }).select(
      "email fullName username"
    );
    for (const u of users) {
      if (!u.email) continue;
      emailService.sendEmail(
        u.email,
        `Support ticket from Qwlee — ${subject}`,
        `<p>Hi ${u.fullName || u.username || "there"},</p>
         <p>The Qwlee support team has opened a ticket on your account${
           resolvedOrderId
             ? ` regarding order #${String(resolvedOrderId).slice(-8).toUpperCase()}`
             : ""
         }.</p>
         ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
         <p><strong>${escapeHtml(subject)}</strong></p>
         <blockquote style="margin:8px 0;padding:10px 14px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;">
           ${escapeHtml(body)}
         </blockquote>
         <p>Please reply at <a href="${
           process.env.FRONTEND_URL || "http://localhost:8000"
         }/support">your support inbox</a>.</p>`
      );
    }
  } catch (e) {
    /* email is best-effort */
  }

  return ticket;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Lists tickets for either the current user (`viewer="user"`) or the
// admin (`viewer="admin"`). Admin view exposes every non-deleted
// ticket; user view restricts to their own.
async function listTickets({ viewerId, viewer, status, aiEscalated, limit = 50, page = 1 }) {
  const query = { isDeleted: false };
  if (viewer === "user") {
    // Show every ticket the user is a participant in, plus legacy
    // single-user tickets where they're the creator.
    query.$or = [{ participants: viewerId }, { userId: viewerId }];
  }
  if (aiEscalated === true || aiEscalated === "true" || aiEscalated === 1) query.aiEscalated = true;
  if (status && status !== "all") query.status = status;

  const items = await SupportTicket.find(query)
    .sort({ lastMessageAt: -1 })
    .skip(Math.max(0, (page - 1) * limit))
    .limit(limit)
    .populate({ path: "userId", select: "fullName username email image role" })
    .populate({ path: "participants", select: "fullName username email image role" });
  const total = await SupportTicket.countDocuments(query);
  return { results: items, totalResults: total, page, limit };
}

async function getTicket({ ticketId, viewerId, viewer }) {
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    isDeleted: false,
  })
    .populate({ path: "userId", select: "fullName username email image role" })
    .populate({ path: "participants", select: "fullName username email image role" });
  if (!ticket) throw new Error("Ticket not found");
  if (viewer === "user") {
    const idsAllowed = [
      String(ticket.userId?._id || ticket.userId),
      ...(ticket.participants || []).map((p) => String(p?._id || p)),
    ];
    if (!idsAllowed.includes(String(viewerId))) {
      throw new Error("Forbidden");
    }
  }
  const messages = await SupportMessage.find({ ticketId: ticket._id })
    .sort({ createdAt: 1 })
    .populate({ path: "senderId", select: "fullName username email image role" });
  // Open the thread = mark the viewer's unread counter to zero.
  if (viewer === "user" && ticket.unreadByUser > 0) {
    ticket.unreadByUser = 0;
    await ticket.save();
  } else if (viewer === "admin" && ticket.unreadByAdmin > 0) {
    ticket.unreadByAdmin = 0;
    await ticket.save();
  }
  return { ticket, messages };
}

async function postMessage({ ticketId, senderId, senderRole, body }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket || ticket.isDeleted) throw new Error("Ticket not found");
  if (!body) throw new Error("Message body required");

  if (senderRole === "user") {
    const idsAllowed = [
      String(ticket.userId),
      ...(ticket.participants || []).map((p) => String(p)),
    ];
    if (!idsAllowed.includes(String(senderId))) {
      throw new Error("Forbidden");
    }
  }

  const msg = await SupportMessage.create({
    ticketId: ticket._id,
    senderId,
    senderRole,
    body: String(body).slice(0, 4000),
  });

  ticket.lastMessageAt = msg.createdAt;
  if (senderRole === "user") {
    ticket.unreadByAdmin += 1;
    // A reply from the user re-opens a resolved ticket.
    if (ticket.status === "resolved") ticket.status = "open";
  } else {
    ticket.unreadByUser += 1;
    // Admin replied — mark as pending on the user.
    if (ticket.status === "open") ticket.status = "pending";
  }
  await ticket.save();
  return msg;
}

async function updateStatus({ ticketId, status, viewerRole }) {
  if (viewerRole !== "admin") throw new Error("Forbidden");
  const allowed = ["open", "pending", "resolved", "closed"];
  if (!allowed.includes(status)) throw new Error("Invalid status");
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket || ticket.isDeleted) throw new Error("Ticket not found");
  ticket.status = status;
  await ticket.save();
  return ticket;
}

module.exports = {
  createTicket,
  adminCreateTicket,
  listTickets,
  getTicket,
  postMessage,
  updateStatus,
};
