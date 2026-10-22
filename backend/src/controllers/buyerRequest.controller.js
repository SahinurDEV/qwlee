const httpStatus = require("http-status");
const pick = require("../utils/pick");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { buyerRequestService } = require("../services");

const ok = (res, message, data, statusCode = httpStatus.OK) =>
  res.status(statusCode).json(response({ message, status: "OK", statusCode, data }));
const pageOpts = (q) => pick(q, ["limit", "page"]);

module.exports = {
  createRequest: catchAsync(async (req, res) =>
    ok(res, "Request posted", await buyerRequestService.createRequest(req.user, req.body), httpStatus.CREATED)),
  listOpen: catchAsync(async (req, res) =>
    ok(res, "Open requests", await buyerRequestService.listOpenRequests(pick(req.query, ["category", "subCategory", "search", "minBudget"]), pageOpts(req.query), req.user))),
  listMine: catchAsync(async (req, res) =>
    ok(res, "My requests", await buyerRequestService.listMyRequests(req.user, pageOpts(req.query)))),
  getRequest: catchAsync(async (req, res) =>
    ok(res, "Request", await buyerRequestService.getRequest(req.params.requestId, req.user))),
  updateRequest: catchAsync(async (req, res) =>
    ok(res, "Request updated", await buyerRequestService.updateRequest(req.params.requestId, req.user, req.body))),
  createOffer: catchAsync(async (req, res) =>
    ok(res, "Offer sent", await buyerRequestService.createOffer(req.params.requestId, req.user, req.body), httpStatus.CREATED)),
  listMyOffers: catchAsync(async (req, res) =>
    ok(res, "My offers", await buyerRequestService.listMyOffers(req.user, pageOpts(req.query)))),
  withdrawOffer: catchAsync(async (req, res) =>
    ok(res, "Offer withdrawn", await buyerRequestService.withdrawOffer(req.params.offerId, req.user))),
  declineOffer: catchAsync(async (req, res) =>
    ok(res, "Offer declined", await buyerRequestService.declineOffer(req.params.offerId, req.user))),
};
