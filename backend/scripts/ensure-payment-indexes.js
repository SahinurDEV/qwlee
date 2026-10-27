#!/usr/bin/env node
// Idempotent: ensures Payment/orders indexes exist. Safe to re-run.
// Usage (against a non-live URL): MONGODB_URL=... node scripts/ensure-payment-indexes.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const config = require("../src/config/config");

async function main() {
  const url = process.env.MONGODB_URL || config.mongoose.url;
  if (!url) throw new Error("MONGODB_URL required");
  if (process.env.ALLOW_LIVE_INDEX !== "true" && /qwlee(?!_test)/.test(url) && !url.includes("27018")) {
    console.error("Refusing to run against what looks like the live DB. Set ALLOW_LIVE_INDEX=true to override, or point MONGODB_URL at a copy.");
    process.exit(2);
  }
  await mongoose.connect(url);
  require("../src/models/payment.model");
  const Payment = mongoose.model("Payment");
  const before = await Payment.collection.indexes();
  console.log("before", before.map((i) => i.name));
  await Payment.syncIndexes();
  const after = await Payment.collection.indexes();
  console.log("after", after.map((i) => i.name));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
