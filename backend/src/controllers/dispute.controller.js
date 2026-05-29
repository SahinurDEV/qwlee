const httpStatus = require("http-status");
const pick = require("../utils/pick");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { disputeService } = require("../services");

const openDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.openDispute(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(
    response({ message: "Dispute opened", status: "OK", statusCode: httpStatus.CREATED, data: dispute })
  );
});

const respondToDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.respondToDispute(req.user.id, req.params.disputeId, req.body);
  res.status(httpStatus.OK).json(
    response({ message: "Response added", status: "OK", statusCode: httpStatus.OK, data: dispute })
  );
});

const escalateDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.escalateDispute(req.user.id, req.params.disputeId);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute escalated", status: "OK", statusCode: httpStatus.OK, data: dispute })
  );
});

const cancelDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.cancelDispute(req.user.id, req.params.disputeId);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute withdrawn", status: "OK", statusCode: httpStatus.OK, data: dispute })
  );
});

const resolveDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.resolveDispute(req.user.id, req.params.disputeId, req.body);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute resolved", status: "OK", statusCode: httpStatus.OK, data: dispute })
  );
});

const getMyDisputes = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["status"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await disputeService.getMyDisputes(req.user.id, filter, options);
  res.status(httpStatus.OK).json(
    response({ message: "Disputes", status: "OK", statusCode: httpStatus.OK, data: result })
  );
});

const getDisputeById = catchAsync(async (req, res) => {
  const dispute = await disputeService.getDisputeById(req.params.disputeId);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute", status: "OK", statusCode: httpStatus.OK, data: dispute })
  );
});

const getDisputesAdmin = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["status"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await disputeService.queryDisputesAdmin(filter, options);
  res.status(httpStatus.OK).json(
    response({ message: "Disputes", status: "OK", statusCode: httpStatus.OK, data: result })
  );
});

module.exports = {
  openDispute,
  respondToDispute,
  escalateDispute,
  cancelDispute,
  resolveDispute,
  getMyDisputes,
  getDisputeById,
  getDisputesAdmin,
};
