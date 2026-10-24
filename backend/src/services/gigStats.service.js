// Cached per-gig rating and completed-order counts, used for search
// filters and "Best rated" / "Best selling" sorting.
const mongoose = require("mongoose");
const { Gig, Reviews, Payment } = require("../models");

async function recompute(gigId) {
  if (!gigId || !mongoose.isValidObjectId(String(gigId))) return;
  const id = new mongoose.Types.ObjectId(String(gigId));
  const [r] = await Reviews.aggregate([{ $match: { gigId: id } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]);
  const sold = await Payment.countDocuments({ gigId: id, status: "delivered" });
  await Gig.updateOne(
    { _id: id },
    { $set: { "rating.avg": r ? Math.round(r.avg * 100) / 100 : 0, "rating.count": r ? r.n : 0, ordersCompleted: sold } }
  );
}

const recomputeLater = (gigId) => setImmediate(() => recompute(gigId).catch(() => {}));

async function recomputeAll() {
  let n = 0;
  for await (const g of Gig.find({}, { _id: 1 }).lean().cursor()) {
    await recompute(g._id);
    n++;
  }
  return n;
}

/**
 * qwlee's Choice: in each category, the active gig with the most completed
 * orders among those with at least choiceMinReviews reviews averaging
 * choiceMinRating or more. One per category; recomputed by housekeeping.
 */
async function chooseChoice() {
  const m = (await require("./siteSettings.service").get()).marketplace;
  const rows = await Gig.aggregate([
    { $match: { gigStatus: "active", isDeleted: { $ne: true }, "rating.count": { $gte: m.choiceMinReviews }, "rating.avg": { $gte: m.choiceMinRating } } },
    { $sort: { ordersCompleted: -1, "rating.avg": -1, "rating.count": -1 } },
    { $group: { _id: "$categoriesId", gig: { $first: "$_id" } } },
  ]);
  const ids = rows.map((r) => r.gig);
  await Gig.updateMany({ choice: true, _id: { $nin: ids } }, { $set: { choice: false } });
  if (ids.length) await Gig.updateMany({ _id: { $in: ids } }, { $set: { choice: true } });
  return ids.length;
}

module.exports = { recompute, recomputeLater, recomputeAll, chooseChoice };
