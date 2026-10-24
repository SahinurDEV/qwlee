const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const chatSchema = mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
    ],
    // Who opened the conversation (first-message limits).
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: {
      type: String,
      enum: ["accepted", "blocked"],
      default: "accepted",
    },
    // Users who blocked this conversation. While anyone is listed here
    // nobody can send new messages in it.
    blockedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    // Per-user inbox organisation.
    archivedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    pinnedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    deletedBy: {
      type: Array,
      default: [],
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
chatSchema.plugin(toJSON);
chatSchema.plugin(paginate);

const chat = mongoose.model("Chat", chatSchema);

module.exports = chat;
