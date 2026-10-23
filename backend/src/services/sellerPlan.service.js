// Seller Plus (Fiverr Seller Plus-style subscription for sellers).
//
//   free     default
//   plus     SELLER_PLUS_PRICE ($25) a month
//   premium  SELLER_PREMIUM_PRICE ($49) a month
// Paid monthly from the seller's balance (no card needed). Perks:
//   - extra proposal credits every period (30 / 80)
//   - a lower platform fee on their sales (1 / 2 percentage points)
//   - a "Plus" / "Premium" badge on their profile and gigs
//   - access to the seller analytics page (already available to all; kept
//     as a listed perk)
// Renewal runs in order housekeeping: if the balance can't cover it, or the
// seller cancelled, the plan drops back to free at the end of the period.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");
const logger = require("../config/logger");

const n = (v, d) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const MONTH = 30 * 864e5;
const plans = () => ({
  free: { id: "free", label: "Free", price: 0, extraCredits: 0, feeDiscount: 0, perks: ["Sell gigs and send offers", "20 free proposal credits a month"] },
  plus: {
    id: "plus", label: "Seller Plus", price: n(process.env.SELLER_PLUS_PRICE, 25), extraCredits: 30, feeDiscount: n(process.env.SELLER_PLUS_FEE_DISCOUNT, 1),
    perks: ["30 extra proposal credits every month", "Platform fee lowered by 1 point", "Plus badge on your profile and gigs"],
  },
  premium: {
    id: "premium", label: "Seller Premium", price: n(process.env.SELLER_PREMIUM_PRICE, 49), extraCredits: 80, feeDiscount: n(process.env.SELLER_PREMIUM_FEE_DISCOUNT, 2),
    perks: ["80 extra proposal credits every month", "Platform fee lowered by 2 points", "Premium badge on your profile and gigs"],
  },
});

const view = (u) => {
  const p = u?.sellerPlan || {};
  const all = plans();
  return { current: { ...all[p.tier || "free"], renewsAt: p.renewsAt || null, cancelAtPeriodEnd: !!p.cancelAtPeriodEnd, since: p.since || null }, plans: Object.values(all), balance: u?.balance ?? null };
};

async function get(userId) {
  return view(await User.findById(userId, "sellerPlan balance role").lean());
}

async function subscribe(user, tier) {
  if (user.role !== "freelancer") throw new ApiError(httpStatus.FORBIDDEN, "Only sellers can subscribe");
  const plan = plans()[tier];
  if (!plan || tier === "free") throw new ApiError(httpStatus.BAD_REQUEST, "Pick plus or premium");
  const cur = await User.findById(user.id, "sellerPlan").lean();
  const curTier = cur?.sellerPlan?.tier || "free";
  if (curTier === tier) {
    // Resume a cancelled plan without charging again.
    await User.updateOne({ _id: user.id }, { $set: { "sellerPlan.cancelAtPeriodEnd": false } });
    return get(user.id);
  }
  // Upgrade or new plan: charge the full price now, new period starts today.
  const now = new Date();
  const u = await User.findOneAndUpdate(
    { _id: user.id, balance: { $gte: plan.price } },
    {
      $inc: { balance: -plan.price, "proposalCredits.bought": plan.extraCredits },
      $set: { "sellerPlan.tier": tier, "sellerPlan.since": now, "sellerPlan.renewsAt": new Date(now.getTime() + MONTH), "sellerPlan.cancelAtPeriodEnd": false, "sellerPlan.lastCharge": plan.price, planBadge: tier },
    },
    { new: true }
  );
  if (!u) throw new ApiError(httpStatus.PAYMENT_REQUIRED, `Your balance doesn't cover $${plan.price.toFixed(2)}. Complete an order or top up first.`);
  return view(u);
}

async function cancel(user) {
  const r = await User.updateOne({ _id: user.id, "sellerPlan.tier": { $in: ["plus", "premium"] } }, { $set: { "sellerPlan.cancelAtPeriodEnd": true } });
  if (!r.matchedCount) throw new ApiError(httpStatus.BAD_REQUEST, "You're on the free plan");
  return get(user.id);
}

const downgrade = (id) => User.updateOne({ _id: id }, { $set: { "sellerPlan.tier": "free", "sellerPlan.renewsAt": null, "sellerPlan.cancelAtPeriodEnd": false, planBadge: "" } });

// Called from order housekeeping.
async function renewDue(now = new Date()) {
  const due = await User.find({ "sellerPlan.tier": { $in: ["plus", "premium"] }, "sellerPlan.renewsAt": { $lte: now } }, "sellerPlan").limit(200).lean();
  let renewed = 0;
  for (const u of due) {
    const plan = plans()[u.sellerPlan.tier];
    if (u.sellerPlan.cancelAtPeriodEnd || !plan) { await downgrade(u._id); continue; }
    const next = new Date(new Date(u.sellerPlan.renewsAt).getTime() + MONTH);
    const ok = await User.updateOne(
      { _id: u._id, "sellerPlan.renewsAt": u.sellerPlan.renewsAt, balance: { $gte: plan.price } },
      { $inc: { balance: -plan.price, "proposalCredits.bought": plan.extraCredits }, $set: { "sellerPlan.renewsAt": next, "sellerPlan.lastCharge": plan.price } }
    );
    if (ok.modifiedCount) renewed++;
    else { await downgrade(u._id); logger.info(`seller plan for ${u._id} ended: balance too low`); }
  }
  return renewed;
}

// Percentage points taken off the platform fee for this seller.
async function feeDiscount(sellerId) {
  if (!sellerId) return 0;
  const u = await User.findById(sellerId, "sellerPlan").lean().catch(() => null);
  return plans()[u?.sellerPlan?.tier || "free"]?.feeDiscount || 0;
}

// Admin → Users: put a seller on a plan without charging (comp / support),
// or back to free.
async function adminSet(userId, tier, days = 30) {
  if (!plans()[tier]) throw new ApiError(httpStatus.BAD_REQUEST, "tier must be free, plus or premium");
  if (tier === "free") { await downgrade(userId); return get(userId); }
  const d = Math.min(Math.max(Number(days) || 30, 1), 365);
  const now = new Date();
  const r = await User.updateOne({ _id: userId, role: "freelancer" }, { $set: { "sellerPlan.tier": tier, "sellerPlan.since": now, "sellerPlan.renewsAt": new Date(now.getTime() + d * 864e5), "sellerPlan.cancelAtPeriodEnd": true, "sellerPlan.lastCharge": 0, planBadge: tier } });
  if (!r.matchedCount) throw new ApiError(httpStatus.NOT_FOUND, "Seller not found");
  return get(userId);
}

module.exports = { adminSet, plans, get, subscribe, cancel, renewDue, feeDiscount };
