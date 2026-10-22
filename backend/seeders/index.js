/* eslint-disable no-console */
// Top-level seeder orchestrator.
//
//   npm run seed              # reset + full reseed
//   npm run seed:reset        # drop all collections, no insert
//   node seeders/index.js --only=users,gigs
//
// All seed data lives under backend/seeders/*. Each module exports an async
// function that receives the accumulated context and returns new entities
// to merge into it. Order below mirrors the dependency graph.

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

// Loading the models index registers every Mongoose model.
require("../src/models");

const { seedUsers } = require("./usersSeeder");
const { seedCategories } = require("./categoriesSeeder");
const { seedGigs } = require("./gigsSeeder");
const { seedPortfolios } = require("./portfoliosSeeder");
const { seedOrders } = require("./ordersSeeder");
const { seedReviews } = require("./reviewsSeeder");
const { seedWithdrawals } = require("./withdrawalsSeeder");
const { seedGigLoves } = require("./giglovesSeeder");
const { seedChats } = require("./chatsSeeder");
const { seedOrderMessages } = require("./orderMessagesSeeder");
const { seedNotifications } = require("./notificationsSeeder");
const { seedBlogs } = require("./blogsSeeder");
const { seedBanners } = require("./bannersSeeder");
const { seedContent } = require("./contentSeeder");
const { seedEnrich } = require("./enrichSeeder");
const { seedRequests } = require("./requestsSeeder");

// Ordered list. Each entry: [phase name, seeder fn, list of keys it produces].
const PIPELINE = [
  ["users", seedUsers],
  ["categories", seedCategories],
  ["gigs", seedGigs],
  ["portfolios", seedPortfolios],
  ["orders", seedOrders],
  ["reviews", seedReviews],
  ["withdrawals", seedWithdrawals],
  ["gigLoves", seedGigLoves],
  ["chats", seedChats],
  ["orderMessages", seedOrderMessages],
  ["notifications", seedNotifications],
  ["blogs", seedBlogs],
  ["banners", seedBanners],
  ["content", seedContent],
  ["requests", seedRequests],
  // Enrichment last — fills in fields added after the original seeders
  // were written: gig.stats, gig.gigStatus, review.orderId, review
  // .sellerReply, user.isVerified, payment.extensionRequest /
  // cancellation*, search logs, admin-mediated support tickets.
  ["enrich", seedEnrich],
];

function parseArgs(argv) {
  const args = { reset: false, only: null };
  for (const a of argv) {
    if (a === "--reset") args.reset = true;
    else if (a === "--only" || a === "--users-only") args.only = ["users"];
    else if (a.startsWith("--only=")) args.only = a.slice(7).split(",");
  }
  return args;
}

async function dropAllCollections() {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
  console.log(`  ✓ cleared ${collections.length} collections`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL missing from .env");

  console.log(`→ connecting to ${url}`);
  await mongoose.connect(url);

  if (args.reset) {
    console.log("→ resetting all collections");
    await dropAllCollections();
    if (args.only === null && process.argv.includes("--reset-only")) {
      await mongoose.disconnect();
      console.log("✓ reset complete");
      return;
    }
  } else {
    // Default behaviour for `npm run seed`: reset, then seed. Safer than
    // appending duplicate documents on every run.
    console.log("→ resetting all collections (default)");
    await dropAllCollections();
  }

  const ctx = {};
  const summary = [];

  for (const [name, fn] of PIPELINE) {
    if (args.only && !args.only.includes(name)) continue;
    process.stdout.write(`→ seeding ${name.padEnd(14)} `);
    try {
      const result = await fn(ctx);
      Object.assign(ctx, result);
      const count = Object.values(result).reduce(
        (n, v) => n + (Array.isArray(v) ? v.length : 1),
        0
      );
      console.log(`✓ (${count} docs)`);
      summary.push([name, count]);
    } catch (err) {
      console.log("✗ failed");
      console.error(err);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  console.log("\n✓ seed complete");
  console.log("---------------------------------------------------");
  for (const [name, count] of summary) console.log(`  ${name.padEnd(16)} ${count}`);
  console.log("---------------------------------------------------");
  console.log("Demo credentials:");
  console.log("  admin   → admin@example.com    / Admin123!");
  console.log("  seller  → seller@example.com   / Seller123!");
  console.log("  buyer   → buyer@example.com    / Buyer123!");

  if (Array.isArray(ctx.payments) && ctx.payments.length > 0) {
    console.log("\nSample order URLs (live in this seed):");
    for (const p of ctx.payments.slice(0, 3)) {
      console.log(`  /order/${p._id}   (${p.status})`);
    }
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
