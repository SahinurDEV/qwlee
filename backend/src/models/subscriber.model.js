const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// Newsletter sign-ups from the site footer.
const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    source: { type: String, default: "footer", maxlength: 40 },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" },
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
subscriberSchema.plugin(toJSON);
subscriberSchema.plugin(paginate);
module.exports = mongoose.model("Subscriber", subscriberSchema);
