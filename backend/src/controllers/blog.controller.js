const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { blogService } = require("../services");
const he = require("he");

const createBlog = catchAsync(async (req, res) => {
  req.body.description = he.decode(req.body.description);
  const { title, author, tags, content, description } = req.body;
  const kind = req.body.kind === "guide" ? "guide" : "article";
  const blogData = { title, author, tags, content, description, kind };

  if (title) {
    blogData.slug = title.toLowerCase().split(" ").join("-");
  }

  if (!req.file?.cloudUrl) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");
  }
  blogData.image = req.file.cloudUrl;

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
  const filter = pick(req.query, ["title"]);
  if (req.query.kind === "guide") filter.kind = "guide";
  else if (req.query.kind === "article") filter.kind = { $ne: "guide" };
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
  req.body.description = he.decode(req.body.description);
  if (req.body.kind !== undefined) req.body.kind = req.body.kind === "guide" ? "guide" : "article";
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
