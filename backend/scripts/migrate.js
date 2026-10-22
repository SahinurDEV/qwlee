/**
 * Idempotent, backward-compatible data migration for the order/escrow and
 * gig-content changes. Safe to run repeatedly: `npm run migrate`.
 *  - sanitises existing gig descriptions (stored XSS fix)
 *  - backfills escrow / requirements / delivery fields on legacy orders
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const sanitizeHtml = require("../src/utils/sanitizeHtml");

async function run() {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL missing");
  await mongoose.connect(url);
  const db = mongoose.connection.db;

  let gigsFixed = 0;
  for await (const g of db.collection("gigs").find({ description: { $type: "string" } }, { projection: { description: 1 } })) {
    const clean = sanitizeHtml(g.description);
    if (clean !== g.description) {
      await db.collection("gigs").updateOne({ _id: g._id }, { $set: { description: clean } });
      gigsFixed++;
    }
  }

  const orders = db.collection("payments");
  const noEscrow = { escrow: { $exists: false } };
  const held = await orders.updateMany({ ...noEscrow, status: { $in: ["active", "late", "disputed"] } },
    [{ $set: { escrow: { status: "held", amount: "$price", provider: "legacy", heldAt: "$createdAt" } } }]);
  // Legacy delivered orders were already credited to the seller.
  const released = await orders.updateMany({ ...noEscrow, status: "delivered" },
    [{ $set: { escrow: { status: "released", amount: "$price", provider: "legacy", releasedAt: "$updatedAt" }, completionReason: "legacy" } }]);
  const refunded = await orders.updateMany({ ...noEscrow, status: "cancelled" },
    [{ $set: { escrow: { status: "refunded", amount: "$price", provider: "legacy", refundedAt: "$updatedAt" } } }]);
  const req = await orders.updateMany({ requirementsStatus: { $exists: false } }, { $set: { requirementsStatus: "not_required" } });
  const del = await orders.updateMany({ delivery: { $exists: false } }, { $set: { delivery: { state: "none", count: 0 } } });

  // Categories predating subcategories are top-level.
  const cats = await db.collection("categories").updateMany({ parentId: { $exists: false } }, { $set: { parentId: null } });

  console.log(JSON.stringify({ categoriesBackfilled: cats.modifiedCount, gigsSanitised: gigsFixed, escrowHeld: held.modifiedCount, escrowReleased: released.modifiedCount,
    escrowRefunded: refunded.modifiedCount, requirementsBackfilled: req.modifiedCount, deliveryBackfilled: del.modifiedCount }));
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
