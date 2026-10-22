const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Gig, User } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");

// Fiverr-style seller level thresholds. The frontend filter sends a
// short identifier (`new`, `level1`, `level2`, `topRated`) and we
// translate to a (minRating, minReviews, verifiedOnly?) tuple. Tuned
// to the seeded dataset's review distribution so the filters return
// non-empty results.
const LEVEL_RULES = {
  new: { maxReviews: 1 },
  level1: { minRating: 4.0, minReviews: 2 },
  level2: { minRating: 4.5, minReviews: 2 },
  topRated: { minRating: 4.8, minReviews: 2 },
};

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
  const gig = await Gig.create(data);
  return gig;
};

const queryGigs = async (filter, options, { excludeUserId, viewer } = {}) => {
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
    sellerFilter.language = { $regex: `^${escapeRegex(filter.language)}$`, $options: "i" };
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
  if (filter.minRating) {
    sellerFilter["review.rating"] = { $gte: Number(filter.minRating) };
  }
  if (filter.level && LEVEL_RULES[filter.level]) {
    const rule = LEVEL_RULES[filter.level];
    if (rule.minRating != null) {
      sellerFilter["review.rating"] = {
        ...(sellerFilter["review.rating"] || {}),
        $gte: rule.minRating,
      };
    }
    if (rule.minReviews != null) {
      sellerFilter["review.total"] = {
        ...(sellerFilter["review.total"] || {}),
        $gte: rule.minReviews,
      };
    }
    if (rule.maxReviews != null) {
      sellerFilter["review.total"] = {
        ...(sellerFilter["review.total"] || {}),
        $lte: rule.maxReviews,
      };
    }
    if (rule.verifiedOnly) sellerFilter.isVerified = true;
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
  const seller = ["language", "country", "online", "verifiedOnly", "minRating", "level"];
  for (const key of Object.keys(filter)) {
    if (seller.includes(key)) continue;
    if (key === "title" && filter[key] !== "") {
      query[key] = { $regex: escapeRegex(filter[key]), $options: "i" };
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
  "title", "description", "price", "package", "categoriesId", "subCategoryId",
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
    patch.gigStatus = next;
  }
  Object.assign(gig, patch);

  // Append the new images to the existing images array
  if (images && images.length > 0) {
    gig.images = gig.images ? gig.images : [];
    gig.images.push(...images); // Add multiple images to the existing array
  }

  // Save the updated gig
  await gig.save();
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
