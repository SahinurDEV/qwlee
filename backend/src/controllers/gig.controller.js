const sanitizeHtml = require("../utils/sanitizeHtml");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const he = require("he");
const { gigService } = require("../services");

const createGig = catchAsync(async (req, res) => {
  const { title, package, categoriesId, description, price } = req.body;

  // Parse JSON fields with error handling
  const parsedPackage = gigService.validatePackages(package);
  if (!title || String(title).trim().length < 15) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Title must be at least 15 characters");
  }

  // Treat description as a string
  const parsedDescription = sanitizeHtml(he.decode(description));

  let imagesArray = [];

  if (!req.files) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");
  }

  if (req.files) {
    req.files.forEach((file) => {
      if (file.cloudUrl) imagesArray.push(file.cloudUrl);
    });
  }
  if (imagesArray.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");
  }

  const gigData = {
    ...gigService.sanitiseGigExtrasFields(req.body),
    title,
    package: parsedPackage,
    categoriesId,
    subCategoryId: req.body.subCategoryId || null,
    description: parsedDescription,
    price: Math.min(...parsedPackage.map((p) => p.price)),
    images: imagesArray,
    userId: req.user.id,
  };

  gigData.title = String(title).trim().slice(0, 120);
  // Admin setting: new gigs wait for approval in the moderation queue.
  if ((await require("../services/siteSettings.service").get()).marketplace.requireGigApproval) {
    gigData.gigStatus = "pending";
  }
  gigData.slug = `${gigService.slugify(title)}-${Date.now().toString(36)}`;

  const gig = await gigService.createGig(gigData);
  res.status(httpStatus.CREATED).json(
    response({
      message: "Gig Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: gig,
    })
  );
});

const gigImageUpload = catchAsync(async (req, res) => {
  let images = [];

  if (req.files) {
    req.files.forEach((file) => {
      if (file.cloudUrl) images.push(file.cloudUrl);
    });
  }

  const gig = await gigService.updateGigById(req.query.gigId, {}, images, req.user);
  res.status(httpStatus.OK).json(
    response({
      message: "Gig Images Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gig,
    })
  );
});


const getGigs = catchAsync(async (req, res) => {
  const filter = pick(req.query, [
    'title',
    'slug',
    'categories',
    'subCategory',
    'minPrice',
    'maxPrice',
    'delivery',
    'language',
    'country',
    'online',
    'verifiedOnly',
    'minRating',
    'level',
    'featured',
    'minGigRating',
    'minReviews',
    'hasVideo',
  ]);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  // Cap page size so ?limit=100000 can't dump the whole catalogue.
  if (options.limit !== undefined) options.limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 100);
  // When the caller is signed in, hide their own gigs from the public
  // marketplace — a freelancer browsing in Buying mode shouldn't see
  // gigs they themselves sell (you can't buy from yourself). Skip the
  // exclusion when the request looks like a single-gig lookup (slug or
  // an explicit userId filter) so a seller can still preview their own
  // gig detail page or see their own gigs on their profile.
  const isLookup = !!filter.slug;
  const excludeUserId = !isLookup ? req.user?.id : undefined;
  const viewer = req.user ? { id: String(req.user.id), role: req.user.role } : null;
  const searchFilter = { ...filter };
  const result = await gigService.queryGigs(filter, options, { excludeUserId, viewer });
  // Sponsored gigs: up to two promoted gigs matching the same search, on
  // the first page of a marketplace search only.
  if (!isLookup && !searchFilter.userId && Number(options.page || 1) === 1) {
    const promo = require("../services/promotion.service");
    const pool = await gigService.queryGigs(searchFilter, { limit: 20 }, { excludeUserId, viewer: null, promotedOnly: true });
    const picked = (pool.results || []).map((g) => (g.toJSON ? g.toJSON() : g)).sort(() => Math.random() - 0.5).slice(0, promo.SLOTS);
    result.promoted = picked;
    if (picked.length) promo.track(picked.map((g) => g.id || g._id), "impressions").catch(() => {});
  }
  res.status(httpStatus.OK).json(
    response({
      message: 'All Gigs',
      status: 'OK',
      statusCode: httpStatus.OK,
      data: result
    })
  );
});

const getGig = catchAsync(async (req, res) => {
  let gig = await gigService.getGigById(req.params.gigId);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Gig",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { gig },
    })
  );
});

const getGigBySlug = catchAsync(async (req, res) => {
  let gig = await gigService.getGigBySlug(req.params.slug);
  if (!gig) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Gig",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { gig },
    })
  );
});

const updateGig = catchAsync(async (req, res) => {
  if (typeof req.body.description === "string") {
    req.body.description = sanitizeHtml(he.decode(req.body.description));
  }
  const gig = await gigService.updateGigById(req.params.gigId, req.body, undefined, req.user);
  res.status(httpStatus.OK).json(
    response({
      message: "Gig Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gig,
    })
  );
});

const gigSingleImageDelete = catchAsync(async (req, res) => {
  const gig = await gigService.gigSingleImageDelete(
    req.query.gigId,
    req.query.imagePath,
    req.user
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Gig Image Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: gig,
    })
  );
});

const deleteGig = catchAsync(async (req, res) => {
  await gigService.deleteGigById(req.params.gigId, req.user);
  res.status(httpStatus.OK).json(
    response({
      message: "Gig Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const publicGigs = catchAsync(async (req, res) => {
  if (!req.query.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "userId query parameter is required");
  }
  const result = await gigService.publicGigs(req.query.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "All Gigs",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

module.exports = {
  createGig,
  getGigs,
  getGig,
  updateGig,
  deleteGig,
  gigImageUpload,
  getGigBySlug,
  gigSingleImageDelete,
  publicGigs,
};
