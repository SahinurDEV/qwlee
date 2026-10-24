// "More from this seller" and "People also viewed" for the gig page.
const mongoose = require("mongoose");
const { Gig } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");

const LIVE = { gigStatus: "active", isDeleted: { $ne: true } };
const POP = [
  { path: "userId", select: PUBLIC_USER_SELECT },
  { path: "categoriesId", select: "name" },
];

const moreFromSeller = async (gig, limit = 8) =>
  Gig.find({ ...LIVE, userId: gig.userId, _id: { $ne: gig._id } })
    .sort({ ordersCompleted: -1, createdAt: -1 })
    .limit(limit)
    .populate(POP);

const related = async (gigId) => {
  if (!mongoose.isValidObjectId(gigId)) return null;
  const gig = await Gig.findOne({ _id: gigId, ...LIVE }).select("userId categoriesId subCategoryId slug");
  if (!gig) return null;
  return { moreFromSeller: await moreFromSeller(gig) };
};

module.exports = { related };
