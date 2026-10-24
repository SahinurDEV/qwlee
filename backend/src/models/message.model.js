const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const offerSchema = new mongoose.Schema({
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: false,
  },
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  gigTitle: {
    type: String,
    required: false,
  },
  slug: {
    type: String,
    required: false,
  },
  description: { type: String, required: false },
  revisionDays: { type: String, required: false },
  deliveryTime: { type: Date, required: false },
  price: { type: Number, required: false },
  // Optional payment plan (see milestones.service).
  milestones: {
    type: [{ _id: false, title: String, amount: Number, days: Number }],
    default: undefined,
  },
  isExpirationTime: { type: Boolean, required: false },
  expiration: { type: String, require: false },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: false,
  },
});
// Lightweight gig snapshot embedded on the first message a buyer sends
// from a gig page — same role as Fiverr's "you've contacted X about gig
// Y" card. We snapshot the fields the card renders (title, image,
// price, delivery) so the bubble keeps working even if the gig is
// later edited or deleted.
const gigReferenceSchema = new mongoose.Schema(
  {
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: false },
    title: { type: String, required: false },
    image: { type: String, required: false },
    price: { type: Number, required: false },
    slug: { type: String, required: false },
    deliveryDays: { type: Number, required: false },
  },
  { _id: false }
);

const messageSchema = mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    content: {
      messageType: {
        type: String,
        enum: [
          "image",
          "application",
          "audio",
          "video",
          "unknown",
          "text",
          "offer",
        ],
        required: false,
      },
      message: { type: String, required: false },
      files: {
        type: Array,
        default: [],
      },
      offerDetails: offerSchema,
      gigReference: gigReferenceSchema,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: false,
    },
    deletedBy: {
      type: Array,
      default: [],
    },
    readAt: { type: Date, default: null },
    // "Delete for everyone": the sender wiped the content; a tombstone
    // stays so the thread keeps its shape.
    deletedForEveryone: { type: Boolean, default: false },
    // Set when the sender edits the text (allowed for a short window).
    editedAt: { type: Date, default: null },
    // One reaction per member: [{ user, emoji }].
    reactions: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          emoji: String,
        },
      ],
      default: [],
    },
    // Automatic "I'm away" reply sent on the seller's behalf.
    autoReply: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    readed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.plugin(toJSON);
messageSchema.plugin(paginate);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
