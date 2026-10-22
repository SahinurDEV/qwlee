const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Categories, Gig } = require("../models");
const { escapeRegex } = require("../utils/publicUser");

const mongoose = require("mongoose");

// Only one level of nesting: a parent must exist and be top-level itself.
const validateParent = async (parentId, selfId) => {
  if (parentId === undefined) return undefined;
  if (parentId === null || parentId === "" || parentId === "null") return null;
  if (!mongoose.isValidObjectId(parentId)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parentId");
  if (selfId && String(parentId) === String(selfId)) throw new ApiError(httpStatus.BAD_REQUEST, "A category cannot be its own parent");
  const parent = await Categories.findById(parentId);
  if (!parent) throw new ApiError(httpStatus.BAD_REQUEST, "Parent category not found");
  if (parent.parentId) throw new ApiError(httpStatus.BAD_REQUEST, "Subcategories cannot have subcategories");
  if (selfId && (await Categories.exists({ parentId: selfId }))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A category with subcategories cannot become a subcategory");
  }
  return parent._id;
};

const pickCategoryFields = (data = {}) => {
  const out = {};
  for (const k of ["name", "image", "icon", "type", "parentId"]) if (data[k] !== undefined) out[k] = data[k];
  return out;
};

const createCategory = async (data) => {
  const fields = pickCategoryFields(data);
  const parentId = await validateParent(fields.parentId);
  if (parentId !== undefined) fields.parentId = parentId;
  const categories = await Categories.create(fields);
  return categories;
};

const queryCategories = async (filter, options) => {

  const query = {};

  // Loop through each filter field and add conditions if they exist
  // Default: top-level categories only (back-compatible with clients that
  // predate subcategories). `parentId=<id>` lists one parent's
  // subcategories; `level=sub` lists all subcategories; `level=all` both.
  const level = filter.level;
  delete filter.level;
  if (filter.parentId) {
    if (!mongoose.isValidObjectId(filter.parentId)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parentId");
  } else {
    delete filter.parentId;
    if (level === "sub") query.parentId = { $ne: null };
    else if (level !== "all") query.parentId = null;
  }
  for (const key of Object.keys(filter)) {
    if (key === "name" && filter[key] !== "") {
      query[key] = { $regex: escapeRegex(filter[key]), $options: "i" };
    } else if (filter[key] !== "") {
      query[key] = filter[key];
    }
  }

  const categories = await Categories.paginate(query, options);
  return categories;
};

const getCategoryById = async (categoryId) => {
  const category = await Categories.findById(categoryId);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }
  return category;
};


const updateCategoryById = async (categoryId, data) => {
  const category = await getCategoryById(categoryId);
  const fields = pickCategoryFields(data);
  const parentId = await validateParent(fields.parentId, category._id);
  if (parentId !== undefined) fields.parentId = parentId;
  Object.assign(category, fields);
  await category.save();
  return category;
};

const deleteCategoryById = async (categoryId) => {
  if (await Categories.exists({ parentId: categoryId })) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Delete or move its subcategories first");
  }
  const category = await Categories.findByIdAndDelete(categoryId);
  if (category) await Gig.updateMany({ subCategoryId: category._id }, { $set: { subCategoryId: null } });
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }
  return category;
};


module.exports = {
    createCategory,
    queryCategories,
    getCategoryById,
    updateCategoryById,
    deleteCategoryById
};
