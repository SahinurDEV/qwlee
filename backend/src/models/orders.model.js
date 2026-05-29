const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const ordersSchema = mongoose.Schema(
  {
    freelancerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    gigId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Gig",
      required: true,
    },
    data: {
      type: Object,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "late", "delivered","cancelled","disputed"],
      default: "active",
    },
    deliveryDate: {
      type: Date,
      required: true,
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
ordersSchema.plugin(paginate);

const Orders = mongoose.model("Orders", ordersSchema);

module.exports = Orders;
