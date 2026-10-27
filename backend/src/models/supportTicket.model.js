// Support ticket — a conversation between a user and the admin team.
//
// Status flow: open → pending (admin waiting on user) → resolved → closed.
// Soft-delete via isDeleted so historical tickets stay around for audit.
//
// Messages live in their own collection (supportMessage.model.js) so a
// busy ticket doesn't bloat the parent document.

const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const ticketSchema = mongoose.Schema(
  {
    // Original creator (the user who clicked Open ticket, or the admin
    // when this is an admin-initiated ticket about an order).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // All users with read/reply access. For a user-opened ticket this
    // is just [userId]. For an admin-opened "about this order" ticket
    // this contains both the buyer and the seller, so a single thread
    // reaches both parties at once (Fiverr-style mediation).
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      index: true,
    },
    // Who actually opened the ticket — useful to distinguish
    // user-reported tickets from admin-initiated mediations.
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    openedByRole: {
      type: String,
      enum: ["user", "admin", ""],
      default: "user",
    },
    // Optional reference to the order this ticket is about — set when
    // the admin opens a ticket from /dashboard/orders so the thread
    // shows the originating order context to both parties.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    // Free-form admin reason (e.g. "Refund requested", "Rule violation:
    // off-platform contact"). Shown above the message thread.
    reason: { type: String, default: "" },
    subject: { type: String, required: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["billing", "orders", "account", "trust-safety", "ip", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["open", "pending", "resolved", "closed"],
      default: "open",
    },
    lastMessageAt: { type: Date, default: Date.now },
    unreadByUser: { type: Number, default: 0 },
    unreadByAdmin: { type: Number, default: 1 }, // initial message is unread
    isDeleted: { type: Boolean, default: false },
    // AI support inbox: set when the assistant escalates to a human
    aiEscalated: { type: Boolean, default: false, index: true },
    aiConfidence: { type: Number, default: null },
    aiCitations: { type: [{ source: String, quote: String, why: String }], default: [] },
    aiDraftAnswer: { type: String, default: "" },
    aiSource: { type: String, default: "" },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, lastMessageAt: -1 });
ticketSchema.index({ participants: 1, lastMessageAt: -1 });
ticketSchema.plugin(toJSON);
ticketSchema.plugin(paginate);

module.exports = mongoose.model("SupportTicket", ticketSchema);
