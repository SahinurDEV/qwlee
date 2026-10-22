const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { GigLove } = require("../models");

const mongoose = require("mongoose");
const { Gig } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");

const gigLove = async (gigId, userId) => {
  if (!mongoose.isValidObjectId(String(gigId)) || !(await Gig.exists({ _id: gigId, isDeleted: { $ne: true } }))) {
    throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  }
  const gigLoveCheck = await GigLove.findOne({ gigId, userId });
  if (gigLoveCheck) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Gig already loved");
  }
  const gigLove = await GigLove.create({
    gigId,
    userId,
  });
  return gigLove;
};

const gigUnlove = async (gigId, userId) => {
  const gigLoveCheck = await GigLove.findOne({ gigId, userId });
  if (!gigLoveCheck) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Gig not found");
  }
  const gigUnlove = await GigLove.findOneAndDelete({ gigId, userId });
  return gigUnlove;
};

const gigLoveList = async (filter, options,userId) => {
  if (userId) {
    filter.userId = userId;
  }
  options.populate = [
    {
      path: "gigId",
      // Only what a gig card needs; never the seller's private fields.
      populate: { path: "userId", select: PUBLIC_USER_SELECT },
    }
  ];

  const result = await GigLove.paginate(filter, options);
  return result;
};

module.exports = {
  gigLove,
  gigUnlove,
  gigLoveList,
};
