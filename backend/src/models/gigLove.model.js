const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const gigLoveSchema = mongoose.Schema(
  {
    gigId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Gig",
      required: true,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    // Named collection (Fiverr "lists"). "" = the default "Saved" list.
    collectionName: { type: String, default: "", trim: true, maxlength: 40 },
  },
  {
    timestamps: true,
  }
);
gigLoveSchema.index({ userId: 1, gigId: 1 });
gigLoveSchema.index({ userId: 1, collectionName: 1 });

// add plugin that converts mongoose to json
gigLoveSchema.plugin(toJSON);
gigLoveSchema.plugin(paginate);

const GigLove = mongoose.model("GigLove", gigLoveSchema);

module.exports = GigLove;
