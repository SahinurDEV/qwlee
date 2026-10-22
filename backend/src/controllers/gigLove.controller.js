const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const he = require("he");
const { gigLoveService } = require("../services");

const gigLove = catchAsync(async (req, res) => {
  const gig = await gigLoveService.gigLove(req.query.gigId, req.user.id);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "Gig Love",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: gig,
      })
    );
});

const gigUnlove = catchAsync(async (req, res) => {
  const gig = await gigLoveService.gigUnlove(req.query.gigId, req.user.id);
  res
    .status(httpStatus.CREATED)
    .json(
      response({
        message: "Gig Unlove",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: gig,
      })
    );
});

const gigLoveList = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const filter = {};
  if (typeof req.query.collection === "string") filter.collectionName = req.query.collection.trim().slice(0, 40);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await gigLoveService.gigLoveList(filter, options, userId);
  res
    .status(httpStatus.OK)
    .json(
      response({
        message: "All Gigs",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      })
    );
});

module.exports = {
  gigLove,
  gigUnlove,
  gigLoveList,
};
