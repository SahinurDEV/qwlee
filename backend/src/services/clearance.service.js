// Clearance period for seller earnings.
//
// Earnings from completed work wait `clearanceDays` (admin setting,
// default 14) before they join the withdrawable balance; Top Rated and
// Seller Plus Premium sellers wait `clearanceDaysFast` (default 7).
// 0 days = credit at once (the old behaviour).
//
// Existing balances are not touched: money already in `balance` before
// this feature stays withdrawable. Only new credits go through clearance.
const { Clearance, User, Notification } = require("../models");
const siteSettings = require("./siteSettings.service");
const logger = require("../config/logger");

const round2 = (n) => Math.round(Number(n) * 100) / 100;

async function daysFor(userId) {
  const m = (await siteSettings.get()).marketplace;
  const normal = Number(m.clearanceDays ?? 14);
  const fast = Number(m.clearanceDaysFast ?? 7);
  if (normal <= 0) return 0;
  try {
    const u = await User.findById(userId, "sellerPlan").lean();
    if (u?.sellerPlan?.tier === "premium") return Math.min(normal, fast);
    const lv = await require("./sellerLevel.service").computeLevelOverview(userId);
    const id = lv?.current?.id || lv?.level?.id || lv?.currentLevel?.id;
    if (id === "topRated") return Math.min(normal, fast);
  } catch (e) {
    logger.warn(`clearance level lookup: ${e.message}`);
  }
  return normal;
}

/** Credit seller earnings, through clearance when it is on. */
async function credit(userId, amount, { source = "order", ref = "" } = {}) {
  const a = round2(amount);
  if (!(a > 0)) return null;
  const days = await daysFor(userId);
  if (days <= 0) {
    await User.updateOne({ _id: userId }, { $inc: { balance: a } });
    return null;
  }
  const row = await Clearance.create({ userId, amount: a, source, ref: String(ref || ""), availableAt: new Date(Date.now() + days * 86400000) });
  await User.updateOne({ _id: userId }, { $inc: { pendingBalance: a } });
  return row;
}

/**
 * Take back earnings (refund after completion). Pending rows for this ref
 * are reversed first; whatever is left comes off the balance.
 */
async function debit(userId, amount, { ref = "", source } = {}) {
  let left = round2(amount);
  const q = { userId, status: "pending", ref: String(ref || "") };
  if (source) q.source = source;
  const rows = await Clearance.find(q).sort({ createdAt: -1 });
  for (const r of rows) {
    if (left <= 0) break;
    const take = Math.min(left, r.amount);
    const upd = take >= r.amount
      ? await Clearance.updateOne({ _id: r._id, status: "pending" }, { $set: { status: "reversed" } })
      : await Clearance.updateOne({ _id: r._id, status: "pending" }, { $inc: { amount: -take } });
    if (upd.modifiedCount) {
      await User.updateOne({ _id: userId }, { $inc: { pendingBalance: -take } });
      left = round2(left - take);
    }
  }
  if (left > 0) await User.updateOne({ _id: userId }, { $inc: { balance: -left } });
}

/** Move cleared rows into the balance. Called from housekeeping. */
async function releaseDue(now = new Date()) {
  const due = await Clearance.find({ status: "pending", availableAt: { $lte: now } }).limit(500);
  let n = 0;
  const sendEmail = (await siteSettings.get()).marketplace.fundsClearedEmail !== false;
  for (const r of due) {
    const claimed = await Clearance.updateOne({ _id: r._id, status: "pending" }, { $set: { status: "released", releasedAt: now } });
    if (!claimed.modifiedCount) continue;
    await User.updateOne({ _id: r.userId }, { $inc: { balance: r.amount, pendingBalance: -r.amount } });
    n += 1;
    await Notification.create({ receiverId: r.userId, message: `$${r.amount.toFixed(2)} cleared and is ready to withdraw`, linkId: "earnings", role: "freelancer" }).catch(() => null);
    if (sendEmail) {
      const u = await User.findById(r.userId, "email fullName").lean().catch(() => null);
      if (u?.email) require("./email.service").sendFundsCleared(u.email, { recipientName: u.fullName, amount: r.amount }).catch((e) => logger.warn(`funds cleared email: ${e.message}`));
    }
  }
  return n;
}

async function summary(userId) {
  const rows = await Clearance.find({ userId, status: "pending" }).sort({ availableAt: 1 }).limit(50).lean();
  const pending = round2(rows.reduce((s, r) => s + r.amount, 0));
  return { pending, next: rows.map((r) => ({ amount: r.amount, source: r.source, ref: r.ref, availableAt: r.availableAt })) };
}

module.exports = { credit, debit, releaseDue, summary, daysFor };
