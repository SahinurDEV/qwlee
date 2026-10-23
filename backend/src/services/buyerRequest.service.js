const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { BuyerRequest, RequestOffer, Categories, Gig, Notification } = require("../models");
const { PUBLIC_USER_SELECT, escapeRegex } = require("../utils/publicUser");

const REQUEST_TTL_DAYS = Number(process.env.REQUEST_TTL_DAYS) || 14;
const idOf = (v) => String(v?._id || v?.id || v || "");
const plain = (s, max) => String(s || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const num = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));

const notify = (receiverId, message, linkId, role) =>
  Notification.create({ receiverId, message, linkId, role, type: "request" }).catch(() => null);

const validateCategory = async (categoriesId, subCategoryId) => {
  let cat = null;
  let sub = null;
  if (categoriesId) {
    if (!mongoose.isValidObjectId(categoriesId)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category");
    cat = await Categories.findById(categoriesId);
    if (!cat || cat.parentId) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown category");
  }
  if (subCategoryId) {
    if (!mongoose.isValidObjectId(subCategoryId)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid subcategory");
    sub = await Categories.findById(subCategoryId);
    if (!sub || !cat || String(sub.parentId) !== String(cat._id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Subcategory does not belong to the category");
    }
  }
  return { categoriesId: cat?._id || null, subCategoryId: sub?._id || null };
};

const requestFields = async (body, { partial } = {}) => {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = plain(body.title, 120);
    if (out.title.length < 10) throw new ApiError(httpStatus.BAD_REQUEST, "Title must be at least 10 characters");
  }
  if (!partial || body.description !== undefined) {
    out.description = plain(body.description, 5000);
    if (out.description.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Description must be at least 20 characters");
  }
  if (!partial || body.budget !== undefined) {
    out.budget = num(body.budget);
    if (!(out.budget >= 5 && out.budget <= 100000)) throw new ApiError(httpStatus.BAD_REQUEST, "Budget must be between 5 and 100000");
  }
  if (!partial || body.deliveryDays !== undefined) {
    out.deliveryDays = Math.round(num(body.deliveryDays));
    if (!(out.deliveryDays >= 1 && out.deliveryDays <= 90)) throw new ApiError(httpStatus.BAD_REQUEST, "Delivery must be 1-90 days");
  }
  if (!partial || body.categoriesId !== undefined || body.subCategoryId !== undefined) {
    Object.assign(out, await validateCategory(body.categoriesId, body.subCategoryId));
  }
  return out;
};

const createRequest = async (buyer, body) => {
  const fields = await requestFields(body);
  const risk = require("./risk.service");
  const screened = await risk.screenAll([fields.title, fields.description], { contact: true });
  const created = await BuyerRequest.create({
    ...fields,
    buyerId: buyer.id,
    expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86400000),
  });
  risk.record("request", created._id, buyer.id, screened.reasons, fields.title);
  return created;
};

const POPULATE = [
  { path: "buyerId", select: PUBLIC_USER_SELECT },
  { path: "categoriesId", select: "name icon" },
  { path: "subCategoryId", select: "name parentId" },
];

/** Open requests for sellers to browse (never the viewer's own). */
const listOpenRequests = async (filter, options, viewer) => {
  const query = { status: "open", expiresAt: { $gt: new Date() } };
  if (filter.category && mongoose.isValidObjectId(filter.category)) query.categoriesId = filter.category;
  if (filter.subCategory && mongoose.isValidObjectId(filter.subCategory)) query.subCategoryId = filter.subCategory;
  if (filter.search) query.title = { $regex: escapeRegex(String(filter.search)), $options: "i" };
  if (filter.minBudget) query.budget = { ...(query.budget || {}), $gte: Number(filter.minBudget) || 0 };
  if (viewer?.id) query.buyerId = { $ne: viewer.id };
  const result = await BuyerRequest.paginate(query, { sortBy: "createdAt:desc", ...options, populate: POPULATE });
  if (viewer?.id && result.results.length) {
    const mine = await RequestOffer.find(
      { sellerId: viewer.id, requestId: { $in: result.results.map((r) => r._id || r.id) } },
      { requestId: 1, status: 1 }
    ).lean();
    const byReq = Object.fromEntries(mine.map((o) => [String(o.requestId), o.status]));
    result.results = result.results.map((r) => ({ ...r.toJSON(), myOfferStatus: byReq[idOf(r)] || null }));
  }
  return result;
};

const listMyRequests = async (buyer, options) =>
  BuyerRequest.paginate({ buyerId: buyer.id }, { sortBy: "createdAt:desc", ...options, populate: POPULATE });

const getRequestDoc = async (requestId) => {
  if (!mongoose.isValidObjectId(requestId)) throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  const r = await BuyerRequest.findById(requestId);
  if (!r) throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  return r;
};

/** Owner sees all offers; a seller sees only their own; others just the request. */
const getRequest = async (requestId, viewer) => {
  const doc = await BuyerRequest.findById((await getRequestDoc(requestId))._id).populate(POPULATE);
  const isOwner = viewer && idOf(doc.buyerId) === String(viewer.id);
  const isOpen = doc.status === "open" && doc.expiresAt > new Date();
  if (!isOpen && !isOwner && viewer?.role !== "admin") {
    const mine = viewer && (await RequestOffer.exists({ requestId: doc._id, sellerId: viewer.id }));
    if (!mine) throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  }
  const offerFilter = isOwner || viewer?.role === "admin" ? { requestId: doc._id } : viewer ? { requestId: doc._id, sellerId: viewer.id } : null;
  const offers = offerFilter
    ? await RequestOffer.find(offerFilter)
        .sort({ createdAt: -1 })
        .populate({ path: "sellerId", select: PUBLIC_USER_SELECT })
        .populate({ path: "gigId", select: "title slug images" })
    : [];
  return { request: doc, offers, isOwner: !!isOwner };
};

const updateRequest = async (requestId, buyer, body) => {
  let screened = null;
  const r = await getRequestDoc(requestId);
  if (idOf(r.buyerId) !== String(buyer.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your request");
  if (body.status !== undefined) {
    if (body.status === "closed" && r.status === "open") {
      r.status = "closed";
      // Closed without hiring: sellers get their proposal credits back.
      const credits = require("./credits.service");
      const offers = await RequestOffer.find({ requestId: r._id, status: "pending", "credits.spent": { $gt: 0 }, "credits.refunded": { $ne: true } });
      for (const o of offers) {
        const done = await RequestOffer.updateOne({ _id: o._id, "credits.refunded": { $ne: true } }, { $set: { "credits.refunded": true } });
        if (done.modifiedCount) await credits.refund(o.sellerId, o.credits.spent, o.credits.from);
      }
    }
    else if (body.status === "open" && r.status === "closed") {
      r.status = "open";
      r.expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 86400000);
    } else throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status change");
  }
  const editable = ["title", "description", "budget", "deliveryDays", "categoriesId", "subCategoryId"];
  const patch = Object.fromEntries(editable.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  if (Object.keys(patch).length) {
    if (r.status !== "open") throw new ApiError(httpStatus.BAD_REQUEST, "Only open requests can be edited");
    if (patch.subCategoryId !== undefined && patch.categoriesId === undefined) patch.categoriesId = r.categoriesId;
    const clean = await requestFields(patch, { partial: true });
    screened = await require("./risk.service").screenAll([clean.title, clean.description], { contact: true });
    Object.assign(r, clean);
  }
  await r.save();
  if (screened) require("./risk.service").record("request", r._id, buyer.id, screened.reasons, r.title);
  return r;
};

const createOffer = async (requestId, seller, body) => {
  if (seller.role !== "freelancer") throw new ApiError(httpStatus.FORBIDDEN, "Only sellers can send offers");
  const r = await getRequestDoc(requestId);
  if (idOf(r.buyerId) === String(seller.id)) throw new ApiError(httpStatus.BAD_REQUEST, "You cannot offer on your own request");
  if (r.status !== "open" || r.expiresAt <= new Date()) throw new ApiError(httpStatus.BAD_REQUEST, "This request is no longer open");
  const price = num(body.price);
  const deliveryDays = Math.round(num(body.deliveryDays));
  const revisions = body.revisions === undefined ? 1 : Math.round(num(body.revisions));
  const message = plain(body.message, 2000);
  if (!(price >= 5 && price <= 100000)) throw new ApiError(httpStatus.BAD_REQUEST, "Price must be between 5 and 100000");
  if (!(deliveryDays >= 1 && deliveryDays <= 90)) throw new ApiError(httpStatus.BAD_REQUEST, "Delivery must be 1-90 days");
  if (!(revisions >= 0 && revisions <= 20)) throw new ApiError(httpStatus.BAD_REQUEST, "Revisions must be 0-20");
  if (message.length < 10) throw new ApiError(httpStatus.BAD_REQUEST, "Message must be at least 10 characters");
  const screened = await require("./risk.service").screen(message, { contact: true });
  let gigId = null;
  if (body.gigId) {
    const gig = mongoose.isValidObjectId(body.gigId) ? await Gig.findById(body.gigId) : null;
    if (!gig || gig.isDeleted || idOf(gig.userId) !== String(seller.id)) throw new ApiError(httpStatus.BAD_REQUEST, "Gig not found");
    gigId = gig._id;
  }
  // A withdrawn/declined offer may be replaced with a new one.
  const prior = await RequestOffer.findOne({ requestId: r._id, sellerId: seller.id });
  if (prior && ["pending", "accepted"].includes(prior.status)) {
    throw new ApiError(httpStatus.CONFLICT, "You already sent an offer on this request");
  }
  const credits = require("./credits.service");
  const paid = await credits.spend(seller.id);
  const fields = { buyerId: r.buyerId, gigId, price, deliveryDays, revisions, message, status: "pending", orderId: null, credits: { spent: paid.spent || 0, from: paid.from || "", refunded: false } };
  const offer = prior
    ? await Object.assign(prior, fields).save()
    : await RequestOffer.create({ requestId: r._id, sellerId: seller.id, ...fields });
  await BuyerRequest.updateOne({ _id: r._id }, { $inc: { offersCount: prior ? 0 : 1 } });
  require("./risk.service").record("offer", offer._id, seller.id, screened.reasons, message);
  notify(r.buyerId, `New offer on your request "${r.title}"`, String(r._id), "buyer");
  return offer;
};

const getOfferDoc = async (offerId) => {
  if (!mongoose.isValidObjectId(offerId)) throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  const o = await RequestOffer.findById(offerId);
  if (!o) throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  return o;
};

const withdrawOffer = async (offerId, seller) => {
  const o = await getOfferDoc(offerId);
  if (idOf(o.sellerId) !== String(seller.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your offer");
  const updated = await RequestOffer.findOneAndUpdate({ _id: o._id, status: "pending" }, { $set: { status: "withdrawn" } }, { new: true });
  if (!updated) throw new ApiError(httpStatus.CONFLICT, `Offer is already ${o.status}`);
  return updated;
};

const declineOffer = async (offerId, buyer) => {
  const o = await getOfferDoc(offerId);
  if (idOf(o.buyerId) !== String(buyer.id)) throw new ApiError(httpStatus.FORBIDDEN, "Not your request");
  const updated = await RequestOffer.findOneAndUpdate({ _id: o._id, status: "pending" }, { $set: { status: "declined" } }, { new: true });
  if (!updated) throw new ApiError(httpStatus.CONFLICT, `Offer is already ${o.status}`);
  notify(o.sellerId, "Your offer was declined", String(o.requestId), "freelancer");
  return updated;
};

const listMyOffers = async (seller, options) =>
  RequestOffer.paginate(
    { sellerId: seller.id },
    { sortBy: "createdAt:desc", ...options, populate: [{ path: "requestId", select: "title status budget deliveryDays buyerId" }] }
  );

/**
 * Pricing for checkout of an accepted request offer. Called by
 * orderLifecycle.quoteCheckout; the price always comes from the stored offer.
 */
const quoteRequestOffer = async (offerId, buyerId) => {
  const o = await getOfferDoc(offerId);
  if (idOf(o.buyerId) !== String(buyerId)) throw new ApiError(httpStatus.FORBIDDEN, "This offer is not for you");
  if (o.status !== "pending") throw new ApiError(httpStatus.CONFLICT, `Offer is already ${o.status}`);
  const r = await BuyerRequest.findById(o.requestId);
  if (!r || r.status !== "open") throw new ApiError(httpStatus.CONFLICT, "This request is no longer open");
  const gig = o.gigId ? await Gig.findById(o.gigId) : null;
  return { offer: o, request: r, gig };
};

/** After payment: accept this offer, decline the rest, mark the request hired. */
const markOfferHired = async (offerId, orderId) => {
  const o = await RequestOffer.findOneAndUpdate(
    { _id: offerId, status: "pending" },
    { $set: { status: "accepted", orderId } },
    { new: true }
  );
  if (!o) return null;
  await BuyerRequest.updateOne({ _id: o.requestId }, { $set: { status: "hired", hiredOfferId: o._id, orderId } });
  await RequestOffer.updateMany({ requestId: o.requestId, _id: { $ne: o._id }, status: "pending" }, { $set: { status: "declined" } });
  notify(o.sellerId, "Your offer was accepted — a new order is waiting", String(orderId), "freelancer");
  return o;
};

module.exports = {
  createRequest,
  listOpenRequests,
  listMyRequests,
  getRequest,
  updateRequest,
  createOffer,
  withdrawOffer,
  declineOffer,
  listMyOffers,
  quoteRequestOffer,
  markOfferHired,
};
