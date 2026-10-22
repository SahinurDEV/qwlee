const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { HelpArticle } = require("../models");

const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const view = (a, full = false) => ({
  id: String(a._id), title: a.title, slug: a.slug, category: a.category, audience: a.audience,
  excerpt: String(a.body || "").replace(/\s+/g, " ").slice(0, 180),
  ...(full ? { body: a.body, helpfulYes: a.helpfulYes, helpfulNo: a.helpfulNo, views: a.views, published: a.published, order: a.order } : {}),
  updatedAt: a.updatedAt,
});

async function listPublic({ q, category, audience } = {}) {
  const f = { published: true };
  if (category) f.category = String(category).slice(0, 60);
  if (audience === "buyer" || audience === "seller") f.audience = { $in: ["all", audience] };
  const term = String(q || "").trim().slice(0, 100);
  if (term) {
    const re = { $regex: esc(term), $options: "i" };
    f.$or = [{ title: re }, { body: re }, { category: re }];
  }
  const rows = await HelpArticle.find(f).sort({ category: 1, order: 1, title: 1 }).limit(200).lean();
  const categories = await HelpArticle.aggregate([{ $match: { published: true } }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  return { results: rows.map((a) => view(a)), categories: categories.map((c) => ({ name: c._id, count: c.count })) };
}

async function getPublic(slug) {
  const a = await HelpArticle.findOneAndUpdate({ slug: String(slug).toLowerCase(), published: true }, { $inc: { views: 1 } }, { new: true }).lean();
  if (!a) throw new ApiError(httpStatus.NOT_FOUND, "Article not found");
  const related = await HelpArticle.find({ published: true, category: a.category, _id: { $ne: a._id } }).sort({ order: 1 }).limit(5).lean();
  const { helpfulYes, helpfulNo, views, ...pub } = view(a, true);
  void helpfulYes; void helpfulNo; void views;
  return { ...pub, related: related.map((r) => view(r)) };
}

async function feedback(slug, helpful) {
  const r = await HelpArticle.updateOne({ slug: String(slug).toLowerCase(), published: true }, { $inc: helpful ? { helpfulYes: 1 } : { helpfulNo: 1 } });
  if (!r.matchedCount) throw new ApiError(httpStatus.NOT_FOUND, "Article not found");
}

function clean(body = {}, partial = false) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = String(body.title || "").trim().slice(0, 160);
    if (!out.title) throw new ApiError(httpStatus.BAD_REQUEST, "Title is required");
  }
  if (body.slug !== undefined || !partial) out.slug = slugify(body.slug || out.title);
  if (out.slug === "") throw new ApiError(httpStatus.BAD_REQUEST, "Slug is required");
  if (body.category !== undefined) out.category = String(body.category || "General").trim().slice(0, 60) || "General";
  if (body.audience !== undefined) out.audience = ["all", "buyer", "seller"].includes(body.audience) ? body.audience : "all";
  if (body.body !== undefined) out.body = String(body.body).slice(0, 20000);
  if (body.published !== undefined) out.published = !!body.published;
  if (body.order !== undefined) out.order = Math.max(-1000, Math.min(1000, Number(body.order) || 0));
  return out;
}

const dup = (e) => {
  if (e?.code === 11000) throw new ApiError(httpStatus.CONFLICT, "Another article already uses that slug");
  throw e;
};

async function adminList({ q } = {}) {
  const f = {};
  if (q) f.title = { $regex: esc(String(q).slice(0, 100)), $options: "i" };
  return (await HelpArticle.find(f).sort({ category: 1, order: 1, title: 1 }).limit(500).lean()).map((a) => view(a, true));
}
async function create(body, adminId) {
  return view((await HelpArticle.create({ ...clean(body), updatedBy: adminId }).catch(dup)).toObject(), true);
}
async function update(id, body, adminId) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.NOT_FOUND, "Article not found");
  const a = await HelpArticle.findByIdAndUpdate(id, { $set: { ...clean(body, true), updatedBy: adminId } }, { new: true, runValidators: true }).lean().catch(dup);
  if (!a) throw new ApiError(httpStatus.NOT_FOUND, "Article not found");
  return view(a, true);
}
async function remove(id) {
  if (!mongoose.isValidObjectId(id) || !(await HelpArticle.findByIdAndDelete(id))) throw new ApiError(httpStatus.NOT_FOUND, "Article not found");
}

module.exports = { listPublic, getPublic, feedback, adminList, create, update, remove, slugify };
