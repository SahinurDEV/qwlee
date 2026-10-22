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

  // ID documents that were stored in the public /uploads folder move to
  // the private store; ones hosted elsewhere (ImgBB) can't be made
  // private and are only counted.
  const fsp = require("fs/promises");
  const path = require("path");
  const pf = require("../src/services/privateFiles.service");
  const { UPLOAD_DIR } = require("../src/services/imageUpload.service");
  let idDocsMoved = 0, idDocsExternal = 0;
  await fsp.mkdir(pf.PRIVATE_DIR, { recursive: true, mode: 0o700 });
  for await (const u of db.collection("users").find({ "verification.status": { $ne: "unsubmitted" } }, { projection: { verification: 1 } })) {
    const set = {};
    for (const k of ["frontUrl", "backUrl", "selfieUrl"]) {
      const v = u.verification?.[k];
      if (!v || String(v).startsWith(pf.PREFIX)) continue;
      const m = String(v).match(/\/uploads\/([a-f0-9]{32}\.(?:jpg|png|gif|webp))$/);
      if (m) {
        try {
          await fsp.rename(path.join(UPLOAD_DIR, m[1]), pf.filePath(m[1]));
          set[`verification.${k}`] = `${pf.PREFIX}${m[1]}`;
          idDocsMoved++;
        } catch { /* file already gone */ }
      } else idDocsExternal++;
    }
    if (Object.keys(set).length) await db.collection("users").updateOne({ _id: u._id }, { $set: set });
  }

  const gigStats = await require("../src/services/gigStats.service").recomputeAll();

  console.log(JSON.stringify({ gigStats, idDocsMoved, idDocsExternal, categoriesBackfilled: cats.modifiedCount, gigsSanitised: gigsFixed, escrowHeld: held.modifiedCount, escrowReleased: released.modifiedCount,
    escrowRefunded: refunded.modifiedCount, requirementsBackfilled: req.modifiedCount, deliveryBackfilled: del.modifiedCount }));
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
