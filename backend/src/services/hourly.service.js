// Hourly contracts with weekly timesheets and billing.
//
// Flow: buyer offers a contract (rate, weekly hour limit) → seller accepts →
// seller logs time (manual entries, never more than the weekly limit) →
// when a week (Monday–Sunday, UTC) is over, housekeeping turns its entries
// into an invoice that the buyer can review for HOURLY_REVIEW_DAYS (5) →
// the buyer approves early or it is paid automatically. Payment comes from
// the buyer's Qwlee balance (demo top-up below, or refunds/credits); the
// seller gets the amount minus the platform fee (Seller Plus discount
// applies). If the buyer's balance is short the invoice is "unpaid" and the
// contract pauses until they top up and pay it. A disputed invoice waits
// for support (Admin → Hourly) to pay or cancel it.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const HourlyContract = require("../models/hourlyContract.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

const REVIEW_DAYS = () => Number(process.env.HOURLY_REVIEW_DAYS) || 5;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const idOf = (v) => String(v?._id || v || "");
const notify = (receiverId, message, linkId, role) => Notification.create({ receiverId, message, linkId: String(linkId), role }).catch(() => null);

// Monday 00:00 UTC of the week containing d.
function weekStart(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = (x.getUTCDay() + 6) % 7; // Mon = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

async function getDoc(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.NOT_FOUND, "Contract not found");
  const c = await HourlyContract.findById(id);
  if (!c) throw new ApiError(httpStatus.NOT_FOUND, "Contract not found");
  return c;
}
const roleIn = (c, user) => (idOf(c.buyerId) === String(user.id) ? "buyer" : idOf(c.sellerId) === String(user.id) ? "seller" : user.role === "admin" ? "admin" : null);
function mustBe(c, user, ...roles) {
  const r = roleIn(c, user);
  if (!r || !roles.includes(r)) throw new ApiError(httpStatus.FORBIDDEN, "Not your contract");
  return r;
}

async function create(buyer, body) {
  const seller = mongoose.isValidObjectId(body.sellerId) ? await User.findById(body.sellerId, "role isDeleted") : await User.findOne({ username: String(body.sellerUsername || "").toLowerCase() }, "role isDeleted");
  if (!seller || seller.isDeleted || seller.role !== "freelancer") throw new ApiError(httpStatus.BAD_REQUEST, "Seller not found");
  if (String(seller._id) === String(buyer.id)) throw new ApiError(httpStatus.BAD_REQUEST, "You can't hire yourself");
  const rate = Number(body.rate);
  const weeklyLimit = Math.round(Number(body.weeklyLimit));
  const title = String(body.title || "").trim();
  if (title.length < 5) throw new ApiError(httpStatus.BAD_REQUEST, "Give the contract a title (5+ characters)");
  if (!(rate >= 3 && rate <= 999)) throw new ApiError(httpStatus.BAD_REQUEST, "Rate must be $3–999 an hour");
  if (!(weeklyLimit >= 1 && weeklyLimit <= 80)) throw new ApiError(httpStatus.BAD_REQUEST, "Weekly limit must be 1–80 hours");
  const c = await HourlyContract.create({ buyerId: buyer.id, sellerId: seller._id, title: title.slice(0, 120), description: String(body.description || "").slice(0, 4000), rate: round2(rate), weeklyLimit });
  notify(seller._id, `New hourly contract offer: "${c.title}"`, c._id, "freelancer");
  return c;
}

async function respond(id, seller, accept) {
  const c = await getDoc(id);
  mustBe(c, seller, "seller");
  if (c.status !== "offered") throw new ApiError(httpStatus.CONFLICT, `Contract is ${c.status}`);
  c.status = accept ? "active" : "declined";
  if (accept) c.startedAt = new Date();
  await c.save();
  notify(c.buyerId, `${accept ? "Accepted" : "Declined"}: hourly contract "${c.title}"`, c._id, "buyer");
  return c;
}

async function setStatus(id, user, action) {
  const c = await getDoc(id);
  const r = mustBe(c, user, "buyer", "seller", "admin");
  if (action === "end") {
    if (!["active", "paused", "offered"].includes(c.status)) throw new ApiError(httpStatus.CONFLICT, `Contract is ${c.status}`);
    c.status = "ended";
    c.endedAt = new Date();
  } else if (action === "pause" || action === "resume") {
    if (r === "seller") throw new ApiError(httpStatus.FORBIDDEN, "Only the client can pause or resume");
    if (action === "pause" && c.status !== "active") throw new ApiError(httpStatus.CONFLICT, "Only active contracts can be paused");
    if (action === "resume") {
      if (c.status !== "paused") throw new ApiError(httpStatus.CONFLICT, "Contract isn't paused");
      if (c.invoices.some((i) => i.status === "unpaid")) throw new ApiError(httpStatus.CONFLICT, "Pay the unpaid invoice first");
    }
    c.status = action === "pause" ? "paused" : "active";
  } else throw new ApiError(httpStatus.BAD_REQUEST, "Unknown action");
  await c.save();
  return c;
}

async function logTime(id, seller, body) {
  const c = await getDoc(id);
  mustBe(c, seller, "seller");
  if (c.status !== "active") throw new ApiError(httpStatus.CONFLICT, "Time can only be logged on an active contract");
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid date");
  if (date > new Date(Date.now() + 864e5)) throw new ApiError(httpStatus.BAD_REQUEST, "Can't log time in the future");
  const ws = weekStart(date);
  if (ws < weekStart(new Date())) throw new ApiError(httpStatus.BAD_REQUEST, "You can only log time for the current week");
  const hours = Math.round(Number(body.hours) * 4) / 4;
  if (!(hours >= 0.25 && hours <= 24)) throw new ApiError(httpStatus.BAD_REQUEST, "Hours must be 0.25–24");
  const used = c.entries.filter((e) => +e.weekStart === +ws).reduce((n, e) => n + e.hours, 0);
  if (used + hours > c.weeklyLimit) throw new ApiError(httpStatus.BAD_REQUEST, `That goes over the ${c.weeklyLimit} h weekly limit (${used} h logged this week)`);
  c.entries.push({ date, weekStart: ws, hours, memo: String(body.memo || "").slice(0, 500) });
  await c.save();
  return c;
}

async function deleteTime(id, seller, entryId) {
  const c = await getDoc(id);
  mustBe(c, seller, "seller");
  const e = c.entries.id(entryId);
  if (!e) throw new ApiError(httpStatus.NOT_FOUND, "Entry not found");
  if (e.invoiceId) throw new ApiError(httpStatus.CONFLICT, "This time is already invoiced");
  e.deleteOne();
  await c.save();
  return c;
}

// Turn finished weeks into invoices. `now` is injectable for tests.
async function closeWeeks(now = new Date()) {
  const thisWeek = weekStart(now);
  const list = await HourlyContract.find({ entries: { $elemMatch: { invoiceId: null, weekStart: { $lt: thisWeek } } } }).limit(200);
  let made = 0;
  for (const c of list) {
    const weeks = new Map();
    for (const e of c.entries) if (!e.invoiceId && e.weekStart < thisWeek) weeks.set(+e.weekStart, [...(weeks.get(+e.weekStart) || []), e]);
    for (const [ws, entries] of weeks) {
      const hours = entries.reduce((n, e) => n + e.hours, 0);
      const inv = c.invoices.create({ weekStart: new Date(ws), hours, amount: round2(hours * c.rate), reviewUntil: new Date(now.getTime() + REVIEW_DAYS() * 864e5) });
      c.invoices.push(inv);
      entries.forEach((e) => { e.invoiceId = inv._id; });
      made++;
      notify(c.buyerId, `Weekly invoice: ${hours} h on "${c.title}" — review it within ${REVIEW_DAYS()} days`, c._id, "buyer");
    }
    await c.save();
  }
  return made;
}

async function feeFor(sellerId) {
  const base = await require("./appConfig.service").getPlatformFeePercent(null);
  const off = await require("./sellerPlan.service").feeDiscount(sellerId);
  return Math.max(0, round2(base - off));
}

// Pay one invoice from the buyer balance (atomic on invoice status).
async function pay(c, invId) {
  const inv = c.invoices.id(invId);
  if (!inv || !["review", "unpaid", "disputed"].includes(inv.status)) return false;
  const prev = inv.status;
  const claimed = await HourlyContract.updateOne({ _id: c._id, invoices: { $elemMatch: { _id: inv._id, status: prev } } }, { $set: { "invoices.$.status": "paying" } }, { runValidators: false, strict: false });
  if (!claimed.modifiedCount) return false;
  const debited = await User.updateOne({ _id: c.buyerId, balance: { $gte: inv.amount } }, { $inc: { balance: -inv.amount } });
  if (!debited.modifiedCount) {
    await HourlyContract.updateOne({ _id: c._id, "invoices._id": inv._id }, { $set: { "invoices.$.status": "unpaid", status: c.status === "active" ? "paused" : c.status } });
    notify(c.buyerId, `Invoice for "${c.title}" couldn't be paid: add funds to your balance`, c._id, "buyer");
    return false;
  }
  const feePercent = await feeFor(c.sellerId);
  const fee = round2((inv.amount * feePercent) / 100);
  const net = round2(inv.amount - fee);
  await require("./clearance.service").credit(c.sellerId, net, { source: "hourly", ref: c._id });
  await HourlyContract.updateOne({ _id: c._id, "invoices._id": inv._id }, { $set: { "invoices.$.status": "paid", "invoices.$.paidAt": new Date(), "invoices.$.feePercent": feePercent, "invoices.$.fee": fee, "invoices.$.net": net } });
  notify(c.sellerId, `Paid: $${net.toFixed(2)} for ${inv.hours} h on "${c.title}"`, c._id, "freelancer");
  return true;
}

async function payDue(now = new Date()) {
  const list = await HourlyContract.find({ invoices: { $elemMatch: { status: "review", reviewUntil: { $lte: now } } } }).limit(200);
  let paid = 0;
  for (const c of list) for (const inv of c.invoices) if (inv.status === "review" && inv.reviewUntil <= now && (await pay(c, inv._id))) paid++;
  return paid;
}

async function invoiceAction(id, user, invId, action, reason) {
  const c = await getDoc(id);
  const r = mustBe(c, user, "buyer", "admin");
  const inv = c.invoices.id(invId);
  if (!inv) throw new ApiError(httpStatus.NOT_FOUND, "Invoice not found");
  if (action === "approve" || action === "pay") {
    if (!["review", "unpaid"].includes(inv.status) && !(r === "admin" && inv.status === "disputed")) throw new ApiError(httpStatus.CONFLICT, `Invoice is ${inv.status}`);
    const ok = await pay(c, inv._id);
    if (!ok) throw new ApiError(httpStatus.PAYMENT_REQUIRED, `Your balance doesn't cover $${inv.amount.toFixed(2)}`);
  } else if (action === "dispute") {
    if (inv.status !== "review") throw new ApiError(httpStatus.CONFLICT, "Only invoices in review can be disputed");
    inv.status = "disputed";
    inv.disputeReason = String(reason || "").slice(0, 1000);
    await c.save();
    notify(c.sellerId, `Invoice disputed on "${c.title}"`, c._id, "freelancer");
  } else throw new ApiError(httpStatus.BAD_REQUEST, "Unknown action");
  return HourlyContract.findById(c._id);
}

const POP = [{ path: "buyerId", select: "fullName username image" }, { path: "sellerId", select: "fullName username image" }];
async function listMine(user) {
  const results = await HourlyContract.find({ $or: [{ buyerId: user.id }, { sellerId: user.id }] }).sort({ updatedAt: -1 }).limit(100).populate(POP);
  return { results };
}
async function getOne(id, user) {
  const c = await getDoc(id);
  const role = mustBe(c, user, "buyer", "seller", "admin");
  await c.populate(POP);
  const ws = weekStart(new Date());
  const thisWeekHours = c.entries.filter((e) => +e.weekStart === +ws).reduce((n, e) => n + e.hours, 0);
  return { contract: c, role, thisWeek: { weekStart: ws, hours: thisWeekHours, limit: c.weeklyLimit } };
}

// Demo-only wallet top-up so buyers can fund hourly work without Stripe.
async function demoTopUp(user, amount) {
  const site = await require("./siteSettings.service").get();
  if (!site.marketplace.demoPayments) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Balance top-ups need demo payments for now");
  const a = round2(amount);
  if (!(a >= 5 && a <= 5000)) throw new ApiError(httpStatus.BAD_REQUEST, "Top up $5–5000");
  const u = await User.findByIdAndUpdate(user.id, { $inc: { balance: a } }, { new: true, projection: "balance" });
  return { balance: u.balance, added: a };
}

module.exports = { weekStart, create, respond, setStatus, logTime, deleteTime, closeWeeks, payDue, invoiceAction, listMine, getOne, demoTopUp };
