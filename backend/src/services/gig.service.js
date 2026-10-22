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

const createGig = async (data) => {
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

const updateGigById = async (gigId, data, images) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }

  // Update gig data if needed
  Object.assign(gig, data);

  // Append the new images to the existing images array
  if (images && images.length > 0) {
    gig.images = gig.images ? gig.images : [];
    gig.images.push(...images); // Add multiple images to the existing array
  }

  // Save the updated gig
  await gig.save();
  return gig;
};




const deleteGigById = async (gigId) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  await Gig.findByIdAndDelete(gigId);
  return gig;
};


const gigSingleImageDelete = async (gigId, image) => {
  let gig = await getGigById(gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  gig.images = gig.images.filter((img) => img !== image);
  await gig.save();
  return gig;
};

module.exports = {
  createGig,
  queryGigs,
  getGigById,
  updateGigById,
  deleteGigById,
  publicGigs,
  getGigBySlug,
  gigSingleImageDelete
};
