// Platform configuration — singleton document storing runtime-editable
// settings the admin manages from /dashboard/setting. Replaces the
// `.env`-only approach for things that should be admin-editable in
// production: payment provider credentials, SMTP, and a generic
// custom-payment-method array for extending past the built-in
// providers without code changes.
//
// Why singleton? There's one platform, one set of provider keys. We
// upsert by `key: "default"` so the document is uniquely addressable
// from the service layer without juggling IDs.

const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ["test", "live"], default: "test" },
    credentials: { type: Object, default: {} },
  },
  { _id: false }
);

const customProviderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    iconUrl: { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ["test", "live"], default: "test" },
    // Free-form key/value bag — whatever the admin wants to plug in.
    credentials: { type: Object, default: {} },
    // Hosted checkout URL template the admin can fill in for redirect
    // flows. Supports {amount} / {currency} / {orderId} placeholders.
    checkoutUrlTemplate: { type: String, default: "" },
  },
  { _id: false }
);

const smtpSchema = new mongoose.Schema(
  {
    host: { type: String, default: "" },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: "" },
    pass: { type: String, default: "" },
    fromEmail: { type: String, default: "" },
    fromName: { type: String, default: "" },
  },
  { _id: false }
);

const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true, index: true },
    payments: {
      stripe: { type: providerSchema, default: () => ({}) },
      paypal: { type: providerSchema, default: () => ({}) },
      paddle: { type: providerSchema, default: () => ({}) },
      lemonsqueezy: { type: providerSchema, default: () => ({}) },
      sslcommerz: { type: providerSchema, default: () => ({}) },
    },
    customPayments: { type: [customProviderSchema], default: [] },
    smtp: { type: smtpSchema, default: () => ({}) },
    // Seller-level tier thresholds. Admin-editable so the platform
    // can re-calibrate as it grows without a deploy. Falls back to a
    // sensible default in the service if missing/empty.
    sellerLevels: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true },
            minOrders: { type: Number, default: 0 },
            minClients: { type: Number, default: 0 },
            minEarnings: { type: Number, default: 0 },
            minRating: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Generic key/value bag for misc platform settings (currency,
    // commission %, support email shown on contact page, etc.) so the
    // admin can drop in arbitrary settings without a schema change.
    misc: { type: Object, default: {} },
    // Admin-editable site settings (see services/siteSettings.service.js).
    site: { type: Object, default: {} },
  },
  { timestamps: true }
);

const AppConfig = mongoose.model("AppConfig", appConfigSchema);

module.exports = AppConfig;
