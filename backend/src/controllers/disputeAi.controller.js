const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { assembleContext } = require("../services/disputeAi/assembleContext");

const getContext = catchAsync(async (req, res) => {
  const ctx = await assembleContext(req.params.disputeId);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute AI context", status: "OK", statusCode: httpStatus.OK, data: ctx })
  );
});

module.exports = { getContext };
