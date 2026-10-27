const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { blogService } = require("../services");
const he = require("he");

const parseList = (v) => {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v || "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
};

const createBlog = catchAsync(async (req, res) => {
  if (req.body.description) req.body.description = he.decode(req.body.description);
  const { title, author, content, description } = req.body;
  const kind = req.body.kind === "guide" ? "guide" : "article";
  const status = ["draft", "scheduled", "published"].includes(req.body.status) ? req.body.status : "published";
  const blogData = {
    title, author, content, description, kind, status,
    tags: parseList(req.body.tags),
    categories: parseList(req.body.categories),
    featured: req.body.featured === true || req.body.featured === "true",
    slug: (req.body.slug || title || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    seo: {
      metaTitle: String(req.body.metaTitle || req.body["seo.metaTitle"] || "").slice(0, 70),
      metaDescription: String(req.body.metaDescription || req.body["seo.metaDescription"] || description || "").slice(0, 170),
      ogImage: String(req.body.ogImage || req.body["seo.ogImage"] || "").slice(0, 500),
    },
  };
  if (req.body.scheduledAt) blogData.scheduledAt = new Date(req.body.scheduledAt);
  if (status === "published") blogData.publishedAt = new Date();
  const words = String(content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  blogData.readingTimeMin = Math.max(1, Math.round(words / 200));

  if (!req.file?.cloudUrl && !req.body.image) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");
  }
  blogData.image = req.file?.cloudUrl || req.body.image;

  const blog = await blogService.createBlog(blogData);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "Blog Created Successfully",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: blog,
      })
    );
});

const getBlog = catchAsync(async (req, res) => {
  const blog = await blogService.getBlogById(req.params.blogId);
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Blog",
        status: "OK",
        statusCode: httpStatus.OK,
        data: blog,
      })
    );
});

const getBlogs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["title", "status", "featured"]);
  if (req.query.kind === "guide") filter.kind = "guide";
  else if (req.query.kind === "article") filter.kind = { $ne: "guide" };
  // Public callers only see published posts; admins can filter by status.
  if (req.user?.role !== "admin") {
    filter.status = "published";
  } else if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.tag) filter.tags = req.query.tag;
  if (req.query.category) filter.categories = req.query.category;
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await blogService.queryBlogs(filter, options);
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "All Blogs",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      })
    );
});

const updateBlog = catchAsync(async (req, res) => {
  if (req.body.description) req.body.description = he.decode(req.body.description);
  if (req.body.kind !== undefined) req.body.kind = req.body.kind === "guide" ? "guide" : "article";
  if (req.body.tags !== undefined) req.body.tags = parseList(req.body.tags);
  if (req.body.categories !== undefined) req.body.categories = parseList(req.body.categories);
  if (req.body.featured !== undefined) req.body.featured = req.body.featured === true || req.body.featured === "true";
  if (req.body.metaTitle || req.body.metaDescription || req.body.ogImage) {
    req.body.seo = {
      metaTitle: String(req.body.metaTitle || "").slice(0, 70),
      metaDescription: String(req.body.metaDescription || "").slice(0, 170),
      ogImage: String(req.body.ogImage || "").slice(0, 500),
    };
  }
  if (req.body.content) {
    const words = String(req.body.content).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    req.body.readingTimeMin = Math.max(1, Math.round(words / 200));
  }
  if (req.body.status === "published") req.body.publishedAt = req.body.publishedAt || new Date();
  const image = req.file?.cloudUrl;
  const blog = image
    ? await blogService.updateBlogById(req.params.blogId, req.body, image)
    : await blogService.updateBlogById(req.params.blogId, req.body);

  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Blog Updated Successfully",
        status: "OK",
        statusCode: httpStatus.OK,
        data: blog,
      })
    );
});

const deleteBlog = catchAsync(async (req, res) => {
  const blog = await blogService.deleteBlogById(req.params.blogId);
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Blog Deleted Successfully",
        status: "OK",
        statusCode: httpStatus.OK,
        data: blog,
      })
    );
});

const slugBlog = catchAsync(async (req, res) => {
  const blog = await blogService.getBlogBySlug(req.params.slug);
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "Blog",
        status: "OK",
        statusCode: httpStatus.OK,
        data: blog,
      })
    )
})

module.exports = {
  createBlog,
  getBlog,
  getBlogs,
  updateBlog,
  deleteBlog,
  slugBlog
};
