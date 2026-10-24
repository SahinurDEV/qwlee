const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { infoService } = require("../services");

const createPrivacy = catchAsync(async (req, res) => {
    const privacy = await infoService.createPrivacy(req.body);
    res.status(httpStatus.CREATED).json(response({ message: "Privacy Created", status: "OK", statusCode: httpStatus.CREATED, data: privacy }));
});

const queryPrivacy = catchAsync(async (req, res) => {
    const result = await infoService.queryPrivacy();
    res.status(httpStatus.OK).json(response({ message: "Privacy", status: "OK", statusCode: httpStatus.OK, data: result }));
});

const createTerms = catchAsync(async (req, res) => {
    const terms = await infoService.createTerms(req.body);
    res.status(httpStatus.CREATED).json(response({ message: "Terms Created", status: "OK", statusCode: httpStatus.CREATED, data: terms }));
});

const queryTerms = catchAsync(async (req, res) => {
    const result = await infoService.queryTerms();
    res.status(httpStatus.OK).json(response({ message: "Terms", status: "OK", statusCode: httpStatus.OK, data: result }));
});

const createTrustSafety = catchAsync(async (req, res) => {
    const trustSafety = await infoService.createTrustSafety(req.body);
    res.status(httpStatus.CREATED).json(response({ message: "Trust & Safety Created", status: "OK", statusCode: httpStatus.CREATED, data: trustSafety }));
});

const queryTrustSafety = catchAsync(async (req, res) => {
    const result = await infoService.queryTrustSafety();
    res.status(httpStatus.OK).json(response({ message: "Trust & Safety", status: "OK", statusCode: httpStatus.OK, data: result }));
});

// Marketplace counters for the homepage stat strip. Cheap to compute and
// cached in front of CloudFront / Vercel would be ideal — for now we just
// run countDocuments on each request; the collections are small.
// Orders live in the Payment collection (the old "Orders" model is unused).
const { User, Gig, Payment, Categories, Reviews } = require("../models");

const getStats = catchAsync(async (req, res) => {
    const [sellers, buyers, gigs, orders, categories] = await Promise.all([
        User.countDocuments({ role: "freelancer", isDeleted: { $ne: true } }),
        User.countDocuments({ role: "buyer", isDeleted: { $ne: true } }),
        Gig.countDocuments({ isDeleted: { $ne: true } }),
        Payment.countDocuments({ status: "delivered" }),
        Categories.countDocuments({}),
    ]);

    // Distinct seller countries — proxy for "global reach".
    const countries = await User.distinct("location", {
        role: "freelancer",
        location: { $ne: "" },
    });
    const countriesCount = countries.filter(Boolean).length;

    // Review count + average for the homepage trust strip.
    const [rev] = await Reviews.aggregate([
        { $match: { rating: { $gte: 1 } } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ]);

    res.status(httpStatus.OK).json(
        response({
            message: "Marketplace stats",
            status: "OK",
            statusCode: httpStatus.OK,
            data: {
                sellers,
                buyers,
                users: sellers + buyers,
                gigs,
                orders,
                categories,
                countries: countriesCount,
                reviews: rev?.count || 0,
                avgRating: rev?.avg ? Math.round(rev.avg * 10) / 10 : null,
            },
        })
    );
});

module.exports = {
    createPrivacy,
    queryPrivacy,
    createTerms,
    queryTerms,
    createTrustSafety,
    queryTrustSafety,
    getStats,
};
