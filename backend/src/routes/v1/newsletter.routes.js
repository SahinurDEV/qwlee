const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { Subscriber } = require("../../models");
const config = require("../../config/config");

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// HMAC token so unsubscribe links can't be forged for other addresses.
const unsubToken = (email) =>
  crypto.createHmac("sha256", String(config.jwt?.secret || process.env.JWT_SECRET || "x")).update(`unsub:${email}`).digest("hex").slice(0, 32);

router.post("/", limiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      return res.status(400).json({ code: 400, message: "Enter a valid email address" });
    }
    await Subscriber.updateOne(
      { email },
      { $set: { status: "subscribed", unsubscribedAt: null }, $setOnInsert: { email, source: String(req.body?.source || "footer").slice(0, 40) } },
      { upsert: true }
    );
    // Same answer whether or not the address was already on the list.
    res.status(200).json({ code: 200, message: "Subscribed" });
  } catch (e) {
    next(e);
  }
});

router.get("/unsubscribe", async (req, res, next) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    const ok = email && req.query.token && crypto.timingSafeEqual(Buffer.from(String(req.query.token).padEnd(32).slice(0, 32)), Buffer.from(unsubToken(email)));
    if (!ok) return res.status(400).send("Invalid unsubscribe link.");
    await Subscriber.updateOne({ email }, { $set: { status: "unsubscribed", unsubscribedAt: new Date() } });
    res.send("You have been unsubscribed.");
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.unsubToken = unsubToken;
