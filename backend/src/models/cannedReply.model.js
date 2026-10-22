const mongoose = require("mongoose");

// Saved replies for the admin support inbox. {name} in the body is filled
// with the ticket owner's first name when inserted.
const cannedReplySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, maxlength: 4000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CannedReply", cannedReplySchema);
