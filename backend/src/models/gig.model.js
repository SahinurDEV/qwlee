const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const gigSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: Array,
      required: true,
    },
    categoriesId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Categories",
      required: true,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    package: {
      type: Array,
    },
    // Optional sub-category (a Categories doc whose parentId is categoriesId).
    // Search tags (Fiverr allows 5), lower-case.
    tags: { type: [String], default: [], index: true },
    subCategoryId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Categories",
      default: null,
      index: true,
    },
    // Paid add-ons the buyer can tick at checkout.
    extras: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 },
        deliveryDays: { type: Number, default: 0, min: 0 },
      },
    ],
    faq: [{ question: String, answer: String, _id: false }],
    // Questions the buyer answers after ordering (delivery clock starts then).
    requirementQuestions: [{ question: String, required: { type: Boolean, default: false }, _id: false }],
    // YouTube / Vimeo / direct video URL shown first in the gallery.
    video: { type: String, default: "" },
    // Lifecycle status — Fiverr-style. Existing gigs default to
    // "active" so the new field is back-compat. Newly created gigs
    // could later default to "pending" once admin moderation is on.
    // Admin-curated: featured gigs sort first and get a badge.
    featured: { type: Boolean, default: false, index: true },
    // End of the current paid promotion (see promotion.service).
    promotedUntil: { type: Date, default: null, index: true },
    gigStatus: {
      type: String,
      enum: [
        "active",
        "pending",
        "requires-modification",
        "draft",
        "denied",
        "paused",
      ],
      default: "active",
      index: true,
    },
    // Per-gig running counters, updated incrementally. Cancellations
    // aren't stored here — they're derived live from the Payment
    // collection so the count stays correct even if an order is
    // refunded / un-cancelled.
    // Cached from reviews / completed orders (services/gigStats.service.js).
    rating: { avg: { type: Number, default: 0, index: true }, count: { type: Number, default: 0 } },
    ordersCompleted: { type: Number, default: 0, index: true },
    stats: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
    },
    // Admin moderation note shown to the seller when status is
    // "requires-modification" or "denied".
    moderation: {
      reason: { type: String, default: "" },
      reviewedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: { type: Date, default: null },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
gigSchema.plugin(paginate);

const Gig = mongoose.model("Gig", gigSchema);

module.exports = Gig;
