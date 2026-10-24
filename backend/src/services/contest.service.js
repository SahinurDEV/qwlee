// Contests. The prize is taken from the buyer's balance when the contest
// is posted and held until the winner's handover is accepted (by the buyer,
// or automatically CONTEST_HANDOVER_DAYS (7) after it is submitted). The
// winner gets the prize minus the platform fee (Seller Plus discount
// applies). A contest with no entries can be cancelled for a full refund;
// otherwise the buyer must pick a winner (support can cancel and refund).
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const Contest = require("../models/contest.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

const MAX_ENTRIES_PER_SELLER = 3;
const HANDOVER_DAYS = () => Number(process.env.CONTEST_HANDOVER_DAYS) || 7;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const idOf = (v) => String(v?._id || v || "");
const notify = (receiverId, message, linkId, role) => Notification.create({ receiverId, message, linkId: String(linkId), role }).catch(() => null);
const plain = (s, max) => String(s || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
function links(list) {
  const out = (Array.isArray(list) ? list : []).map((u) => String(u).trim()).filter(Boolean).slice(0, 10);
  for (const u of out) if (!/^https?:\/\/[^\s]+$/i.test(u) || u.length > 500) throw new ApiError(httpStatus.BAD_REQUEST, "Links must be http(s) URLs");
  return out;
}

async function getDoc(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.NOT_FOUND, "Contest not found");
  const c = await Contest.findById(id);
  if (!c) throw new ApiError(httpStatus.NOT_FOUND, "Contest not found");
  return c;
}

async function create(buyer, body) {
  const title = plain(body.title, 120);
  const brief = plain(body.brief, 5000);
  const prize = round2(body.prize);
  const days = Math.round(Number(body.days));
  if (title.length < 5) throw new ApiError(httpStatus.BAD_REQUEST, "Title needs 5+ characters");
  if (brief.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Brief needs 20+ characters");
  if (!(prize >= 20 && prize <= 50000)) throw new ApiError(httpStatus.BAD_REQUEST, "Prize must be $20–50,000");
  if (!(days >= 1 && days <= 30)) throw new ApiError(httpStatus.BAD_REQUEST, "Run it for 1–30 days");
  const cat = body.categoriesId && mongoose.isValidObjectId(body.categoriesId) ? body.categoriesId : null;
  const paid = await User.updateOne({ _id: buyer.id, balance: { $gte: prize } }, { $inc: { balance: -prize } });
  if (!paid.modifiedCount) throw new ApiError(httpStatus.PAYMENT_REQUIRED, `Your balance doesn't cover the $${prize.toFixed(2)} prize`);
  try {
    return await Contest.create({ buyerId: buyer.id, title, brief, prize, categoriesId: cat, sealed: !!body.sealed, deadline: new Date(Date.now() + days * 864e5) });
  } catch (e) {
    await User.updateOne({ _id: buyer.id }, { $inc: { balance: prize } });
    throw e;
  }
}

// What a given viewer may see: buyer sees every entry; sealed contests
// show other sellers only their own entries.
function shape(c, viewer) {
  const o = c.toJSON();
  const isOwner = viewer && idOf(c.buyerId) === String(viewer.id);
  const visible = (e) => isOwner || !c.sealed || (viewer && idOf(e.sellerId) === String(viewer.id)) || e.status === "winner";
  o.entryCount = c.entries.filter((e) => e.status !== "withdrawn").length;
  o.entries = o.entries.filter((e, i) => c.entries[i].status !== "withdrawn" || isOwner).filter((e, i) => visible(c.entries[i]));
  if (!isOwner && !(viewer && c.winnerEntryId && c.entries.id(c.winnerEntryId) && idOf(c.entries.id(c.winnerEntryId).sellerId) === String(viewer.id))) o.handover = undefined;
  o.isOwner = !!isOwner;
  return o;
}

async function list({ status = "open", page = 1, limit = 20 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const q = status === "all" ? { status: { $ne: "cancelled" } } : { status };
  const results = await Contest.find(q, "-entries.description -entries.links -handover").sort({ createdAt: -1 }).skip((Math.max(1, Number(page) || 1) - 1) * lim).limit(lim).populate({ path: "buyerId", select: "fullName username image" });
  return { results: results.map((c) => ({ ...c.toJSON(), entries: undefined, entryCount: c.entries.filter((e) => e.status !== "withdrawn").length })) };
}

async function getOne(id, viewer) {
  const c = await getDoc(id);
  await c.populate([{ path: "buyerId", select: "fullName username image" }, { path: "entries.sellerId", select: "fullName username image" }]);
  return shape(c, viewer);
}

async function enter(id, seller, body) {
  if (seller.role !== "freelancer") throw new ApiError(httpStatus.FORBIDDEN, "Only sellers can enter contests");
  const c = await getDoc(id);
  if (idOf(c.buyerId) === String(seller.id)) throw new ApiError(httpStatus.BAD_REQUEST, "You can't enter your own contest");
  if (c.status !== "open" || c.deadline <= new Date()) throw new ApiError(httpStatus.CONFLICT, "This contest isn't taking entries");
  const mine = c.entries.filter((e) => idOf(e.sellerId) === String(seller.id) && e.status === "active").length;
  if (mine >= MAX_ENTRIES_PER_SELLER) throw new ApiError(httpStatus.CONFLICT, `At most ${MAX_ENTRIES_PER_SELLER} entries per seller`);
  const description = plain(body.description, 2000);
  if (description.length < 10) throw new ApiError(httpStatus.BAD_REQUEST, "Describe your entry (10+ characters)");
  const l = links(body.links);
  if (!l.length) throw new ApiError(httpStatus.BAD_REQUEST, "Add at least one link to your work (image, Figma, Drive…)");
  c.entries.push({ sellerId: seller.id, description, links: l });
  await c.save();
  notify(c.buyerId, `New entry in your contest "${c.title}"`, c._id, "buyer");
  return getOne(id, seller);
}

async function withdraw(id, seller, entryId) {
  const c = await getDoc(id);
  const e = c.entries.id(entryId);
  if (!e || idOf(e.sellerId) !== String(seller.id)) throw new ApiError(httpStatus.NOT_FOUND, "Entry not found");
  if (e.status !== "active" || !["open", "judging"].includes(c.status)) throw new ApiError(httpStatus.CONFLICT, "This entry can't be withdrawn");
  e.status = "withdrawn";
  await c.save();
  return getOne(id, seller);
}

async function award(id, buyer, entryId) {
  const c = await getDoc(id);
  if (idOf(c.buyerId) !== String(buyer.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your contest");
  if (!["open", "judging"].includes(c.status)) throw new ApiError(httpStatus.CONFLICT, `Contest is ${c.status}`);
  const e = c.entries.id(entryId);
  if (!e || e.status !== "active") throw new ApiError(httpStatus.BAD_REQUEST, "Pick an active entry");
  const r = await Contest.updateOne({ _id: c._id, status: c.status }, { $set: { status: "handover", winnerEntryId: e._id, "entries.$[w].status": "winner" } }, { arrayFilters: [{ "w._id": e._id }] });
  if (!r.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "Contest changed, try again");
  notify(e.sellerId, `You won "${c.title}"! Hand over the final files to get the prize.`, c._id, "freelancer");
  return getOne(id, buyer);
}

async function submitHandover(id, seller, body) {
  const c = await getDoc(id);
  const w = c.winnerEntryId && c.entries.id(c.winnerEntryId);
  if (!w || idOf(w.sellerId) !== String(seller.id)) throw new ApiError(httpStatus.FORBIDDEN, "Only the winner can hand over");
  if (c.status !== "handover") throw new ApiError(httpStatus.CONFLICT, `Contest is ${c.status}`);
  const l = links(body.links);
  if (!l.length) throw new ApiError(httpStatus.BAD_REQUEST, "Add links to the final files");
  c.handover = { note: plain(body.note, 2000), links: l, submittedAt: new Date() };
  await c.save();
  notify(c.buyerId, `Final files for "${c.title}" are ready — accept them to release the prize`, c._id, "buyer");
  return getOne(id, seller);
}

async function release(c) {
  const w = c.entries.id(c.winnerEntryId);
  const base = await require("./appConfig.service").getPlatformFeePercent(null);
  const off = await require("./sellerPlan.service").feeDiscount(w.sellerId);
  const feePercent = Math.max(0, round2(base - off));
  const fee = round2((c.prize * feePercent) / 100);
  const net = round2(c.prize - fee);
  const r = await Contest.updateOne({ _id: c._id, status: "handover" }, { $set: { status: "completed", payout: { feePercent, fee, net, paidAt: new Date() } } });
  if (!r.modifiedCount) return false;
  await require("./clearance.service").credit(w.sellerId, net, { source: "contest", ref: c._id });
  notify(w.sellerId, `Prize paid: $${net.toFixed(2)} for "${c.title}"`, c._id, "freelancer");
  return true;
}

async function acceptHandover(id, buyer) {
  const c = await getDoc(id);
  if (idOf(c.buyerId) !== String(buyer.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your contest");
  if (c.status !== "handover" || !c.handover?.submittedAt) throw new ApiError(httpStatus.CONFLICT, "Nothing to accept yet");
  if (!(await release(c))) throw new ApiError(httpStatus.CONFLICT, "Already paid");
  return getOne(id, buyer);
}

async function cancel(id, user) {
  const c = await getDoc(id);
  const isAdmin = user.role === "admin";
  if (!isAdmin && idOf(c.buyerId) !== String(user.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your contest");
  if (!["open", "judging"].includes(c.status) && !(isAdmin && c.status === "handover")) throw new ApiError(httpStatus.CONFLICT, `Contest is ${c.status}`);
  if (!isAdmin && c.entries.some((e) => e.status === "active")) throw new ApiError(httpStatus.CONFLICT, "Sellers have entered; pick a winner or ask support");
  const r = await Contest.updateOne({ _id: c._id, status: c.status }, { $set: { status: "cancelled" } });
  if (!r.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "Contest changed, try again");
  await User.updateOne({ _id: c.buyerId }, { $inc: { balance: c.prize } });
  return getOne(id, user);
}

// Housekeeping: close entries at the deadline; auto-accept old handovers.
async function housekeeping(now = new Date()) {
  const closed = await Contest.updateMany({ status: "open", deadline: { $lte: now } }, { $set: { status: "judging" } });
  const due = await Contest.find({ status: "handover", "handover.submittedAt": { $lte: new Date(now - HANDOVER_DAYS() * 864e5) } }).limit(100);
  let paid = 0;
  for (const c of due) if (await release(c)) paid++;
  return (closed.modifiedCount || 0) + paid;
}

async function mine(user) {
  const results = await Contest.find({ $or: [{ buyerId: user.id }, { "entries.sellerId": user.id }] }, "-entries.description -entries.links").sort({ updatedAt: -1 }).limit(100);
  return { results: results.map((c) => ({ ...c.toJSON(), entries: undefined, entryCount: c.entries.filter((e) => e.status !== "withdrawn").length, isOwner: idOf(c.buyerId) === String(user.id) })) };
}

module.exports = { create, list, getOne, enter, withdraw, award, submitHandover, acceptHandover, cancel, housekeeping, mine };
