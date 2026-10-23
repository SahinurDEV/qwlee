// Proposal credits ("Connects"): sending an offer on a buyer request costs
// credits, which keeps low-effort spam down and is a small revenue line.
//   - every seller gets PROPOSAL_CREDITS_MONTHLY free credits (default 20),
//     topped back up 30 days after the last refill (unused free credits
//     don't roll over)
//   - extra credits are bought from the seller's balance in packs of 10 at
//     PROPOSAL_CREDIT_PRICE each (default $0.15); bought credits never expire
//   - each new offer costs PROPOSAL_CREDIT_COST (default 1); free credits
//     are used first. A credit comes back when the buyer cancels/closes the
//     request without hiring anyone.
// PROPOSAL_CREDITS_ENABLED=false turns the whole thing off.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");

const n = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== undefined ? Number(v) : d);
const cfg = () => ({
  enabled: String(process.env.PROPOSAL_CREDITS_ENABLED || "true") !== "false",
  monthly: n(process.env.PROPOSAL_CREDITS_MONTHLY, 20),
  cost: n(process.env.PROPOSAL_CREDIT_COST, 1),
  price: n(process.env.PROPOSAL_CREDIT_PRICE, 0.15),
  pack: 10,
});
const MONTH = 30 * 864e5;

async function refill(userId) {
  const c = cfg();
  const now = new Date();
  // Atomic: only one request refills when the period is over.
  await User.updateOne(
    { _id: userId, $or: [{ "proposalCredits.refillAt": null }, { "proposalCredits.refillAt": { $exists: false } }, { "proposalCredits.refillAt": { $lte: new Date(now - MONTH) } }] },
    { $set: { "proposalCredits.monthly": c.monthly, "proposalCredits.refillAt": now } }
  );
  const u = await User.findById(userId, "proposalCredits balance").lean();
  return u;
}

async function summary(userId) {
  const c = cfg();
  const u = await refill(userId);
  const pc = u?.proposalCredits || {};
  return {
    enabled: c.enabled,
    free: pc.monthly || 0,
    bought: pc.bought || 0,
    total: (pc.monthly || 0) + (pc.bought || 0),
    costPerOffer: c.cost,
    nextRefillAt: pc.refillAt ? new Date(new Date(pc.refillAt).getTime() + MONTH) : null,
    monthlyAllowance: c.monthly,
    packSize: c.pack,
    packPrice: Math.round(c.price * c.pack * 100) / 100,
  };
}

// Take credits for one offer. Throws 402 when there aren't enough.
async function spend(userId) {
  const c = cfg();
  if (!c.enabled || c.cost <= 0) return { spent: 0 };
  await refill(userId);
  const fromFree = await User.findOneAndUpdate({ _id: userId, "proposalCredits.monthly": { $gte: c.cost } }, { $inc: { "proposalCredits.monthly": -c.cost } });
  if (fromFree) return { spent: c.cost, from: "free" };
  const fromBought = await User.findOneAndUpdate({ _id: userId, "proposalCredits.bought": { $gte: c.cost } }, { $inc: { "proposalCredits.bought": -c.cost } });
  if (fromBought) return { spent: c.cost, from: "bought" };
  throw new ApiError(httpStatus.PAYMENT_REQUIRED, `Not enough proposal credits (an offer costs ${c.cost}). Buy more on the Buyer requests page.`);
}

async function refund(userId, amount, from = "bought") {
  if (!amount) return;
  const field = from === "free" ? "proposalCredits.monthly" : "proposalCredits.bought";
  await User.updateOne({ _id: userId }, { $inc: { [field]: amount } });
}

// Buy packs of credits from the seller's balance.
async function buy(userId, packs) {
  const c = cfg();
  if (!c.enabled) throw new ApiError(httpStatus.BAD_REQUEST, "Proposal credits are turned off");
  const p = Math.round(Number(packs));
  if (!(p >= 1 && p <= 20)) throw new ApiError(httpStatus.BAD_REQUEST, "Buy 1–20 packs at a time");
  const cost = Math.round(p * c.pack * c.price * 100) / 100;
  const u = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: cost } },
    { $inc: { balance: -cost, "proposalCredits.bought": p * c.pack } },
    { new: true }
  );
  if (!u) throw new ApiError(httpStatus.PAYMENT_REQUIRED, `Your balance doesn't cover $${cost.toFixed(2)}`);
  return { ...(await summary(userId)), purchased: p * c.pack, charged: cost };
}

module.exports = { summary, spend, refund, buy, cfg };
