const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Gig, User } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");
const { awayFilter } = require("../utils/availability");

// Seller level filter ids (stored on user.sellerLevel by sellerLevel.service).
const LEVEL_RULES = { new: 1, level1: 1, level2: 1, topRated: 1 };

// A subcategory must be a child of the gig's category. Empty clears it.
const resolveSubCategory = async (subCategoryId, categoriesId) => {
  if (subCategoryId === undefined) return undefined;
  if (!subCategoryId || subCategoryId === "null") return null;
  const { Categories } = require("../models");
  const sub = await Categories.findById(subCategoryId).catch(() => null);
  if (!sub || !sub.parentId || String(sub.parentId) !== String(categoriesId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Subcategory does not belong to the selected category");
  }
  return sub._id;
};

const createGig = async (data) => {
  const sub = await resolveSubCategory(data.subCategoryId, data.categoriesId);
  if (sub !== undefined) data.subCategoryId = sub;
  const oldGig = await Gig.findOne({ slug: data.slug });
  if (oldGig) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This title already exists, try another one"
    );
  }
  const risk = require("./risk.service");
  const screened = await risk.screenAll([data.title, data.description]);
  const gig = await Gig.create(data);
  risk.record("gig", gig._id, gig.userId, screened.reasons, gig.title);
  return gig;
};

const queryGigs = async (filter, options, { excludeUserId, viewer, ...extra } = {}) => {
  // Admin-featured gigs: ?featured=true filters; otherwise they sort first.
  const featuredOnly = filter.featured === "true" || filter.featured === true;
  delete filter.featured;
  if (!options.sortBy) options.sortBy = "featured:desc,createdAt";
  // Price range
  if (filter.minPrice || filter.maxPrice) {
    filter.price = {};
    if (filter.minPrice && filter.maxPrice) {
      filter.price = { $gte: Number(filter.minPrice), $lte: Number(filter.maxPrice) };
    } else if (filter.minPrice) {
      filter.price = { $gte: Number(filter.minPrice) };
    } else if (filter.maxPrice) {
      filter.price = { $lte: Number(filter.maxPrice) };
    }
    delete filter.minPrice;
    delete filter.maxPrice;
  }

  options.populate = [
    { path: "userId", select: PUBLIC_USER_SELECT },
    { path: "categoriesId" },
    { path: "subCategoryId", select: "name parentId icon" },
  ];

  // Seller-side filters: language / country / online / verified / level
  // / minRating get resolved against the User collection first, then
  // we constrain the gig query by userId. Keeps the join cheap for
  // typical seller counts and lets us reuse the existing paginator.
  const sellerFilter = {};
  if (filter.language) {
    // Stored as a comma list ("English, Spanish"): match any entry.
    sellerFilter.language = { $regex: `(^|,)\\s*${escapeRegex(filter.language)}\\s*(,|$)`, $options: "i" };
  }
  if (filter.country) {
    sellerFilter.location = { $regex: escapeRegex(filter.country), $options: "i" };
  }
  if (filter.online === "true" || filter.online === true) {
    sellerFilter.online = true;
  }
  if (filter.verifiedOnly === "true" || filter.verifiedOnly === true) {
    sellerFilter.isVerified = true;
  }
  if (filter.pro === "true" || filter.pro === true) {
    sellerFilter.isPro = true;
  }
  if (filter.minRating) {
    sellerFilter["review.rating"] = { $gte: Number(filter.minRating) };
  }
  if (filter.level && LEVEL_RULES[filter.level]) {
    // Stored level (sellerLevel.service) is the single source of truth.
    sellerFilter["sellerLevel.id"] = filter.level === "new" ? { $in: ["new", null] } : filter.level;
  }

  const query = {};
  if (Object.keys(sellerFilter).length > 0) {
    const matchingSellers = await User.find(sellerFilter, { _id: 1 }).lean();
    const ids = matchingSellers.map((u) => u._id);
    // No matching sellers → short-circuit to an empty result.
    if (ids.length === 0) {
      return { results: [], page: 1, limit: Number(options.limit) || 10, totalPages: 0, totalResults: 0 };
    }
    query.userId = { $in: ids };
  }

  // Loop through remaining gig-level fields
  // Gig-level quality filters.
  const gigNum = (v, lo, hi) => (v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.min(hi, Math.max(lo, Number(v))));
  const minGigRating = gigNum(filter.minGigRating, 0, 5);
  if (minGigRating) query["rating.avg"] = { $gte: minGigRating };
  const minReviews = gigNum(filter.minReviews, 0, 100000);
  if (minReviews) query["rating.count"] = { $gte: minReviews };
  if (filter.hasVideo === "true" || filter.hasVideo === true) query.video = { $nin: ["", null] };
  for (const k of ["minGigRating", "minReviews", "hasVideo"]) delete filter[k];

  const seller = ["language", "country", "online", "verifiedOnly", "pro", "minRating", "level"];
  for (const key of Object.keys(filter)) {
    if (seller.includes(key)) continue;
    if (key === "title" && filter[key] !== "") {
      // Match the title or any search tag.
      const re = { $regex: escapeRegex(filter[key]), $options: "i" };
      query.$and = [...(query.$and || []), { $or: [{ title: re }, { tags: re }] }];
    } else if (key === "categories") {
      query["categoriesId"] = filter[key];
    } else if (key === "subCategory") {
      if (filter[key]) query["subCategoryId"] = filter[key];
    } else if (key === "delivery" && filter[key]) {
      // Any of the gig's packages can deliver within N days. Falls
      // back to "Anytime" when the param is missing or 0.
      const maxDays = Number(filter[key]);
      if (maxDays > 0) {
        query.package = { $elemMatch: { deliveryDate: { $lte: maxDays } } };
      }
    } else if (filter[key] !== "" && filter[key] != null) {
      query[key] = filter[key];
    }
  }

  // Visibility: the public marketplace only shows active, non-deleted
  // gigs. Admins see everything; a signed-in seller can also load their
  // own non-active gig by slug (preview / edit flows).
  query.isDeleted = { $ne: true };
  if (viewer?.role !== "admin") {
    if (query.slug && viewer?.id) {
      query.$or = [{ gigStatus: "active" }, { userId: viewer.id }];
    } else {
      query.gigStatus = "active";
    }
  }

  // Sellers in vacation mode drop out of search (their gig pages stay up).
  if (viewer?.role !== "admin" && !query.slug && !filter.userId) {
    const away = await User.find(awayFilter(), { _id: 1 }).lean();
    if (away.length) query.$and = [...(query.$and || []), { userId: { $nin: away.map((u) => u._id) } }];
  }

  if (excludeUserId) {
    if (query.userId && query.userId.$in) {
      query.userId = {
        ...query.userId,
        $nin: [excludeUserId],
      };
    } else {
      query.userId = { $ne: excludeUserId };
    }
  }

  if (featuredOnly) query.featured = true;
  if (extra.promotedOnly) query.promotedUntil = { $gt: new Date() };
  const gigs = await Gig.paginate(query, options);
  return gigs;
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}



const publicGigs = async (userId) => {
  const filter = {
    userId,
    gigStatus: "active",
    isDeleted: { $ne: true },
  };
  const options = {
    populate: [
      { path: "userId", select: PUBLIC_USER_SELECT },
      { path: "categoriesId" },
      { path: "subCategoryId", select: "name parentId icon" },
    ],
  };
  const gigs = await Gig.paginate(filter, options);
  return gigs;
};

const getGigById = async (gigId) => {
  const gig = await Gig.findById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  return gig;
};

const getGigBySlug = async (slug) => {
  console.log(slug)
  const gig = await Gig.findOne({ slug });
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  return gig;
}

// Fields a seller may edit on their own gig. Everything else (owner,
// moderation, stats, slug) is server-managed.
const EDITABLE_GIG_FIELDS = [
  "title", "description", "package", "categoriesId", "subCategoryId", "tags",
  "extras", "faq", "requirementQuestions", "video",
];
const JSON_GIG_FIELDS = ["package", "extras", "faq", "requirementQuestions"];

const assertGigOwner = (gig, actor) => {
  if (!actor) return;
  if (actor.role === "admin") return;
  if (String(gig.userId) !== String(actor.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only change your own gigs");
  }
};

// 1-3 packages: name, price, delivery days, optional revisions/description,
// up to 10 feature lines. Returns the cleaned array.
const validatePackages = (pkgs) => {
  if (typeof pkgs === "string") {
    try { pkgs = JSON.parse(pkgs); } catch (e) { throw new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON in package field"); }
  }
  if (!Array.isArray(pkgs) || pkgs.length < 1 || pkgs.length > 3) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A gig needs 1 to 3 packages");
  }
  return pkgs.map((p, i) => {
    const name = String(p?.name || "").trim().slice(0, 40);
    const price = Number(p?.price);
    const deliveryDate = Math.round(Number(p?.deliveryDate));
    if (!name) throw new ApiError(httpStatus.BAD_REQUEST, `Package ${i + 1} needs a name`);
    if (!(price >= 5 && price <= 100000)) throw new ApiError(httpStatus.BAD_REQUEST, `Package "${name}" price must be between 5 and 100000`);
    if (!(deliveryDate >= 1 && deliveryDate <= 90)) throw new ApiError(httpStatus.BAD_REQUEST, `Package "${name}" delivery must be 1-90 days`);
    const out = {
      name,
      price,
      deliveryDate,
      description: String(p?.description || "").trim().slice(0, 300),
      features: (p?.features || [])
        .map((f) => ({ feature: String(typeof f === "string" ? f : f?.feature || "").trim().slice(0, 120) }))
        .filter((f) => f.feature)
        .slice(0, 10),
    };
    if (p?.revisions !== undefined && p?.revisions !== "" && p?.revisions !== null) {
      const r = Math.round(Number(p.revisions));
      if (!(r >= 0 && r <= 99)) throw new ApiError(httpStatus.BAD_REQUEST, `Package "${name}" revisions must be 0-99`);
      out.revisions = r;
    }
    return out;
  });
};

const slugify = (title) =>
  String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "gig";

// Normalise the Fiverr-style optional sections (extras, FAQ, buyer
// requirement questions, video URL). Accepts JSON strings (multipart).
const sanitiseGigExtrasFields = (data) => {
  const out = {};
  for (const key of JSON_GIG_FIELDS) {
    if (data[key] === undefined) continue;
    let v = data[key];
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch (e) { throw new ApiError(httpStatus.BAD_REQUEST, `Invalid JSON in ${key}`); }
    }
    out[key] = v;
  }
  if (out.extras) {
    out.extras = (Array.isArray(out.extras) ? out.extras : []).slice(0, 10).map((e) => {
      const price = Number(e?.price);
      if (!String(e?.title || "").trim() || !Number.isFinite(price) || price < 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Each extra needs a title and a non-negative price");
      }
      return {
        ...(e?._id ? { _id: e._id } : {}),
        title: String(e.title).trim().slice(0, 120),
        description: String(e.description || "").slice(0, 500),
        price,
        deliveryDays: Math.max(0, Math.min(90, Number(e.deliveryDays) || 0)),
      };
    });
  }
  if (out.faq) {
    out.faq = (Array.isArray(out.faq) ? out.faq : []).slice(0, 20)
      .filter((f) => String(f?.question || "").trim())
      .map((f) => ({ question: String(f.question).trim().slice(0, 300), answer: String(f.answer || "").slice(0, 2000) }));
  }
  if (out.requirementQuestions) {
    out.requirementQuestions = (Array.isArray(out.requirementQuestions) ? out.requirementQuestions : []).slice(0, 10)
      .filter((q) => String(q?.question || "").trim())
      .map((q) => ({ question: String(q.question).trim().slice(0, 500), required: !!q.required }));
  }
  if (data.video !== undefined) {
    const v = String(data.video || "").trim();
    if (v && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(v) && !/^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(v)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Video must be a YouTube/Vimeo link or an https .mp4/.webm URL");
    }
    out.video = v;
  }
  if (data.tags !== undefined) {
    let t = data.tags;
    if (typeof t === "string") {
      try { t = JSON.parse(t); } catch (e) { t = t.split(","); }
    }
    if (!Array.isArray(t)) throw new ApiError(httpStatus.BAD_REQUEST, "tags must be a list");
    const clean = [...new Set(t.map((x) => String(x || "").toLowerCase().replace(/[^a-z0-9 +#.-]/g, "").trim().slice(0, 30)).filter(Boolean))];
    if (clean.length > 5) throw new ApiError(httpStatus.BAD_REQUEST, "Use at most 5 tags");
    out.tags = clean;
  }
  return out;
};

const updateGigById = async (gigId, data, images, actor) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  assertGigOwner(gig, actor);

  const patch = {};
  for (const key of EDITABLE_GIG_FIELDS) {
    if (data?.[key] !== undefined && !JSON_GIG_FIELDS.includes(key) && key !== "video") patch[key] = data[key];
  }
  Object.assign(patch, sanitiseGigExtrasFields(data || {}));
  if (patch.title !== undefined) {
    patch.title = String(patch.title).trim().slice(0, 120);
    if (patch.title.length < 15) throw new ApiError(httpStatus.BAD_REQUEST, "Title must be at least 15 characters");
  }
  if (data?.package !== undefined) {
    patch.package = validatePackages(data.package);
    patch.price = Math.min(...patch.package.map((p) => p.price));
  }
  // Reorder / remove gallery images: must be a subset of the current ones.
  if (data?.images !== undefined) {
    const current = new Set(gig.images || []);
    if (!Array.isArray(data.images) || data.images.some((u) => !current.has(u))) {
      throw new ApiError(httpStatus.BAD_REQUEST, "images may only reorder or remove existing images");
    }
    if (data.images.length < 1) throw new ApiError(httpStatus.BAD_REQUEST, "A gig needs at least one image");
    patch.images = [...new Set(data.images)];
  }
  const categoryChanged = patch.categoriesId !== undefined && String(patch.categoriesId) !== String(gig.categoriesId);
  if (patch.subCategoryId !== undefined || categoryChanged) {
    const subId = patch.subCategoryId !== undefined ? patch.subCategoryId : gig.subCategoryId;
    const target = patch.categoriesId || gig.categoriesId;
    patch.subCategoryId = subId
      ? await resolveSubCategory(subId, target).catch((e) => { if (patch.subCategoryId !== undefined) throw e; return null; })
      : null;
  }
  // Sellers may pause / un-pause; everything else goes through moderation.
  if (data?.gigStatus !== undefined) {
    const next = data.gigStatus;
    const allowed =
      actor?.role === "admin" ||
      (next === "paused" && gig.gigStatus === "active") ||
      (next === "active" && gig.gigStatus === "paused");
    if (!allowed) throw new ApiError(httpStatus.FORBIDDEN, "You cannot set that gig status");
    if (next === "active" && actor?.role !== "admin") await require("./trust.service").assertNotRestricted(gig.userId, "publish gigs");
    patch.gigStatus = next;
  }
  const risk = require("./risk.service");
  const screened = await risk.screenAll([patch.title, patch.description]);
  Object.assign(gig, patch);

  // Append the new images to the existing images array
  if (images && images.length > 0) {
    gig.images = gig.images ? gig.images : [];
    if (gig.images.length + images.length > 6) {
      throw new ApiError(httpStatus.BAD_REQUEST, "A gig can have at most 6 images");
    }
    gig.images.push(...images); // Add multiple images to the existing array
  }

  // Save the updated gig
  await gig.save();
  risk.record("gig", gig._id, gig.userId, screened.reasons, gig.title);
  return gig;
};

const deleteGigById = async (gigId, actor) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  assertGigOwner(gig, actor);
  // Soft delete keeps order history pointing at a real gig.
  gig.isDeleted = true;
  await gig.save();
  return gig;
};


const gigSingleImageDelete = async (gigId, image, actor) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  assertGigOwner(gig, actor);
  gig.images = gig.images.filter((img) => img !== image);
  await gig.save();
  return gig;
};

module.exports = {
  validatePackages,
  slugify,
  sanitiseGigExtrasFields,
  createGig,
  queryGigs,
  getGigById,
  updateGigById,
  deleteGigById,
  publicGigs,
  getGigBySlug,
  gigSingleImageDelete
};
