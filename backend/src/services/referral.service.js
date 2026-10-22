// Referral programme built on coupons (see siteSettings.growth).
const crypto = require("crypto");
const { User, Coupon, Payment } = require("../models");
const coupons = require("./coupon.service");
const siteSettings = require("./siteSettings.service");
const logger = require("../config/logger");

async function codeFor(user) {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(4).toString("hex");
    const r = await User.updateOne({ _id: user._id, referralCode: { $in: [null, ""] } }, { $set: { referralCode: code } }).catch(() => ({ modifiedCount: 0 }));
    if (r.modifiedCount) return code;
    const fresh = await User.findById(user._id).select("referralCode");
    if (fresh?.referralCode) return fresh.referralCode;
  }
  throw new Error("Could not allocate a referral code");
}

/** Called after a new account is created with ?ref=code. */
async function attach(newUser, refCode) {
  try {
    const g = (await siteSettings.get()).growth;
    if (!g.referrals || !refCode) return;
    const inviter = await User.findOne({ referralCode: String(refCode).slice(0, 16) }).select("_id");
    if (!inviter || String(inviter._id) === String(newUser._id)) return;
    await User.updateOne({ _id: newUser._id, referredBy: null }, { $set: { referredBy: inviter._id } });
    if (g.refereePercent > 0) {
      await Coupon.create({
        code: coupons.randomCode("WELCOME"), type: "percent", value: g.refereePercent, maxDiscount: 100,
        maxUses: 1, perUserLimit: 1, onlyUser: newUser._id, firstOrderOnly: true, source: "referral",
        expiresAt: new Date(Date.now() + 90 * 86400e3), note: "Referral welcome discount",
      });
    }
  } catch (e) {
    logger.warn(`referral attach failed: ${e.message}`);
  }
}

/** Called when an order completes: reward the inviter once per invitee. */
async function onOrderCompleted(order) {
  try {
    const g = (await siteSettings.get()).growth;
    if (!g.referrals || !(g.referrerReward > 0)) return;
    const buyer = await User.findOneAndUpdate(
      { _id: order.clientId, referredBy: { $ne: null }, referralRewarded: { $ne: true } },
      { $set: { referralRewarded: true } },
      { new: true }
    ).select("referredBy fullName");
    if (!buyer) return;
    const c = await Coupon.create({
      code: coupons.randomCode("THANKS"), type: "fixed", value: g.referrerReward, maxUses: 1, perUserLimit: 1,
      onlyUser: buyer.referredBy, source: "referral", expiresAt: new Date(Date.now() + 365 * 86400e3),
      note: `Referral reward: ${buyer.fullName || "a friend"} completed their first order`,
    });
    await require("./notification.service").addCustomNotification("buyer-notification", buyer.referredBy, {
      receiverId: buyer.referredBy, role: "buyer", type: "referral", viewStatus: false,
      message: `Your friend completed their first order. Here's $${g.referrerReward} off your next one: ${c.code}`,
    }).catch(() => {});
  } catch (e) {
    logger.warn(`referral reward failed: ${e.message}`);
  }
}

async function summary(user) {
  const code = await codeFor(user);
  const base = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  const [invited, rewarded, myCoupons] = await Promise.all([
    User.countDocuments({ referredBy: user._id }),
    User.countDocuments({ referredBy: user._id, referralRewarded: true }),
    Coupon.find({ onlyUser: user._id, active: true }).sort({ createdAt: -1 }).lean(),
  ]);
  const g = (await siteSettings.get()).growth;
  return {
    enabled: g.referrals,
    code,
    link: `${base}/sign-up?ref=${code}`,
    invited,
    rewarded,
    refereePercent: g.refereePercent,
    referrerReward: g.referrerReward,
    coupons: myCoupons.map((c) => ({
      code: c.code, description: c.type === "percent" ? `${c.value}% off` : `$${c.value} off`,
      used: c.maxUses != null && c.uses >= c.maxUses, expiresAt: c.expiresAt, note: c.note, firstOrderOnly: c.firstOrderOnly,
    })),
  };
}

module.exports = { codeFor, attach, onOrderCompleted, summary };
