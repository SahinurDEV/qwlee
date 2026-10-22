// Saved gigs grouped into named collections, and gig recommendations.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { GigLove, Gig, Payment, User } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");
const { awayFilter } = require("../utils/availability");

const MAX_COLLECTIONS = 30;
const cleanName = (n) => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
const oid = (v) => new mongoose.Types.ObjectId(String(v));

async function list(userId) {
  const rows = await GigLove.aggregate([
    { $match: { userId: oid(userId) } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$collectionName", count: { $sum: 1 }, gigIds: { $push: "$gigId" }, updatedAt: { $max: "$updatedAt" } } },
    { $sort: { updatedAt: -1 } },
  ]);
  const covers = await Gig.find({ _id: { $in: rows.map((r) => r.gigIds[0]) } }, { image: 1, images: 1 }).lean();
  const coverOf = Object.fromEntries(covers.map((g) => [String(g._id), (g.images && g.images[0]) || g.image || null]));
  return rows.map((r) => ({ name: r._id || "", count: r.count, cover: coverOf[String(r.gigIds[0])] || null }));
}

async function move(userId, gigId, name) {
  const to = cleanName(name);
  if (to) {
    const names = await GigLove.distinct("collectionName", { userId, collectionName: { $ne: "" } });
    if (!names.includes(to) && names.length >= MAX_COLLECTIONS) throw new ApiError(httpStatus.BAD_REQUEST, `You can have up to ${MAX_COLLECTIONS} collections`);
  }
  const r = await GigLove.findOneAndUpdate({ userId, gigId }, { $set: { collectionName: to } }, { new: true });
  if (!r) throw new ApiError(httpStatus.NOT_FOUND, "Save the gig first");
  return { gigId: String(gigId), collection: to };
}

async function rename(userId, from, to) {
  const a = cleanName(from);
  const b = cleanName(to);
  if (!a || !b) throw new ApiError(httpStatus.BAD_REQUEST, "Enter a collection name");
  const r = await GigLove.updateMany({ userId, collectionName: a }, { $set: { collectionName: b } });
  if (!r.matchedCount) throw new ApiError(httpStatus.NOT_FOUND, "Collection not found");
  return { name: b, count: r.modifiedCount };
}

/** Deleting a collection keeps its gigs saved (they go back to "Saved"). */
async function remove(userId, name) {
  const a = cleanName(name);
  if (!a) throw new ApiError(httpStatus.BAD_REQUEST, "The default list can't be deleted");
  const r = await GigLove.updateMany({ userId, collectionName: a }, { $set: { collectionName: "" } });
  return { moved: r.modifiedCount };
}

/**
 * "Recommended for you": active gigs sharing categories/tags with what the
 * user saved, ordered or recently viewed (seen ids from the browser),
 * best rated first. Falls back to the best rated gigs overall.
 */
async function recommend({ userId, seen = [], limit = 8 }) {
  limit = Math.min(Math.max(Number(limit) || 8, 1), 24);
  const seenIds = seen.filter((s) => mongoose.isValidObjectId(s)).slice(0, 20).map(oid);
  const signalIds = [...seenIds];
  const exclude = [...seenIds];
  if (userId) {
    const saved = await GigLove.find({ userId }, { gigId: 1 }).limit(100).lean();
    const ordered = await Payment.find({ clientId: userId }, { gigId: 1 }).sort({ createdAt: -1 }).limit(50).lean();
    for (const x of [...saved, ...ordered]) if (x.gigId) signalIds.push(x.gigId);
    for (const x of saved) if (x.gigId) exclude.push(x.gigId);
  }
  const base = { gigStatus: "active", isDeleted: { $ne: true }, _id: { $nin: exclude } };
  const away = await User.find(awayFilter(), { _id: 1 }).lean();
  const notUsers = away.map((u) => u._id);
  if (userId) notUsers.push(oid(userId));
  if (notUsers.length) base.userId = { $nin: notUsers };

  let results = [];
  let personal = false;
  if (signalIds.length) {
    const sig = await Gig.find({ _id: { $in: signalIds } }, { categoriesId: 1, subCategoryId: 1, tags: 1 }).lean();
    const cats = [...new Set(sig.flatMap((g) => [g.categoriesId, g.subCategoryId]).filter(Boolean).map(String))].map(oid);
    const tags = [...new Set(sig.flatMap((g) => g.tags || []))].slice(0, 30);
    const or = [];
    if (cats.length) or.push({ categoriesId: { $in: cats } }, { subCategoryId: { $in: cats } });
    if (tags.length) or.push({ tags: { $in: tags } });
    if (or.length) {
      results = await Gig.find({ ...base, $or: or })
        .sort({ "rating.avg": -1, ordersCompleted: -1, createdAt: -1 })
        .limit(limit)
        .populate({ path: "userId", select: PUBLIC_USER_SELECT })
        .lean();
      personal = results.length > 0;
    }
  }
  if (results.length < limit) {
    const more = await Gig.find({ ...base, _id: { $nin: [...exclude, ...results.map((g) => g._id)] } })
      .sort({ "rating.avg": -1, ordersCompleted: -1, createdAt: -1 })
      .limit(limit - results.length)
      .populate({ path: "userId", select: PUBLIC_USER_SELECT })
      .lean();
    results = results.concat(more);
  }
  return { personal, results: results.map(({ __v, stats, moderation, ...g }) => ({ ...g, id: String(g._id) })) };
}

module.exports = { list, move, rename, remove, recommend, MAX_COLLECTIONS };
