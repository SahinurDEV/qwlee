const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const searchAi = require("../services/searchAi/parse");
const { Categories } = require("../models");
const gigService = require("../services/gig.service");

const parse = catchAsync(async (req, res) => {
  const result = await searchAi.parseQuery(req.body?.query || req.query?.q);
  res.status(httpStatus.OK).send({ code: 200, message: "Search parse", data: { attributes: result } });
});

const smartSearch = catchAsync(async (req, res) => {
  const q = req.body?.query || req.query?.q || "";
  const parsed = await searchAi.parseQuery(q);
  const p = parsed.parse || {};
  const qFilter = {};
  if (p.maxPrice != null) qFilter.maxPrice = p.maxPrice;
  if (p.minPrice != null) qFilter.minPrice = p.minPrice;
  if (p.keywords) qFilter.title = p.keywords;
  if (p.categoryHint) {
    const cat = await Categories.findOne({ name: p.categoryHint }).select("_id name").lean();
    if (cat) qFilter.categoriesId = cat._id;
  }
  const options = {
    limit: Math.min(24, Number(req.body?.limit || req.query?.limit || 12)),
    page: Number(req.body?.page || req.query?.page || 1),
  };
  if (p.sortBy === "price") options.sortBy = "price:asc";

  let results = [];
  let totalResults = 0;
  try {
    const page = await gigService.queryGigs(qFilter, options, {});
    const rows = page.results || [];
    totalResults = page.totalResults || rows.length;
    results = rows.map((g) => {
      const obj = typeof g.toJSON === "function" ? g.toJSON() : g;
      return { ...obj, matchReasons: searchAi.matchReasons(obj, p) };
    });
  } catch (_e) {
    results = [];
  }

  res.status(httpStatus.OK).send({
    code: 200,
    message: "Smart search",
    data: { attributes: { ...parsed, results, totalResults } },
  });
});

module.exports = { parse, smartSearch };
