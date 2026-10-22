const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const notificationSchema = new mongoose.Schema(
  {
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    message: { type: String, required: false },
    image: { type: Object, required: false },
    linkId: { type: String, required: false },
    role: {
      type: String,
      enum: ["admin", "freelancer", "buyer", "unknown"],
      default: "unknown",
    },
    type: {
      type: String,
      enum: ["order", "message",  "payment", "request", "announcement", "unknown"],
      default: "unknown",
    },
    viewStatus: { type: Boolean, enum: [true, false], default: false },
  },
  {
    timestamps: true,
  }
);

// Every stored notification for a user is also sent as a browser push
// (when the user subscribed and allows that category).
notificationSchema.post("save", function (doc) {
  if (!doc.receiverId || doc.role === "admin") return;
  setImmediate(() => {
    const { TYPE_CATEGORY } = require("../services/notificationPrefs.service");
    require("../services/push.service")
      .notifyUser(doc.receiverId, TYPE_CATEGORY[doc.type] || null, { title: "Qwlee", body: doc.message || "You have a new notification", url: "/notifications", tag: String(doc._id) })
      .catch(() => {});
  });
});

// add plugin that converts mongoose to json
// notificationSchema.plugin(toJSON);
notificationSchema.plugin(paginate);

module.exports = mongoose.model("Notification", notificationSchema);
