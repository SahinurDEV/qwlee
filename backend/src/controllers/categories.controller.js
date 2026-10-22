const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { categoriesService } = require("../services");

const createCategory = catchAsync(async (req, res) => {
    if (req.file?.cloudUrl) {
        req.body.image = req.file.cloudUrl;
      }
    const categories = await categoriesService.createCategory(req.body);
    res.status(httpStatus.CREATED).json(response({ message: "Category Created", status: "OK", statusCode: httpStatus.CREATED, data: categories }));
});

const getCategories = catchAsync(async (req, res) => {
    const filter = pick(req.query, ["type", "name", "parentId", "level"]);
    const options = pick(req.query, ["sortBy", "limit", "page"]);
    const result = await categoriesService.queryCategories(filter, options);
    res.status(httpStatus.OK).json(response({ message: "All Categories", status: "OK", statusCode: httpStatus.OK, data: result }));
});

const getCategory = catchAsync(async (req, res) => {
    let categories = await categoriesService.getCategoryById(req.params.categoryId);
    if (!categories) {
      throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
    }
    res.status(httpStatus.OK).json(response({ message: "Category", status: "OK", statusCode: httpStatus.OK, data: { categories } }));
});

const updateCategory = catchAsync(async (req, res) => {
    if (req.file?.cloudUrl) {
        req.body.image = req.file.cloudUrl;
      }

    const categories = await categoriesService.updateCategoryById(req.query.categoryId, req.body);
    res.status(httpStatus.OK).json(response({ message: "Category Updated", status: "OK", statusCode: httpStatus.OK, data: categories }));
});

const deleteCategory = catchAsync(async (req, res) => {
    await categoriesService.deleteCategoryById(req.params.categoryId);
    res.status(httpStatus.OK).json(response({ message: "Category Deleted", status: "OK", statusCode: httpStatus.OK, data: {} }));
});

module.exports = {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory
  };
  