const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { assembleContext } = require("../services/disputeAi/assembleContext");
const suggestSvc = require("../services/disputeAi/suggest");
const { DisputeAiSuggestion } = require("../models");

const getContext = catchAsync(async (req, res) => {
  const ctx = await assembleContext(req.params.disputeId);
  res.status(httpStatus.OK).json(
    response({ message: "Dispute AI context", status: "OK", statusCode: httpStatus.OK, data: ctx })
  );
});

const getStatus = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).json(
    response({ message: "Dispute AI status", status: "OK", statusCode: httpStatus.OK, data: suggestSvc.status() })
  );
});

const postSuggest = catchAsync(async (req, res) => {
  const mock = Boolean(req.body?.mock);
  const data = await suggestSvc.suggest(req.user.id, req.params.disputeId, { mock });
  res.status(httpStatus.OK).json(
    response({ message: "Dispute AI suggestion", status: "OK", statusCode: httpStatus.OK, data })
  );
});

const postFeedback = catchAsync(async (req, res) => {
  const { suggestionId, action, outcome, note, amount } = req.body || {};
  if (!suggestionId) {
    return res.status(httpStatus.BAD_REQUEST).json(
      response({ message: "suggestionId required", status: "ERROR", statusCode: httpStatus.BAD_REQUEST, data: {} })
    );
  }
  const row = await DisputeAiSuggestion.findById(suggestionId);
  if (!row) {
    return res.status(httpStatus.NOT_FOUND).json(
      response({ message: "Suggestion not found", status: "ERROR", statusCode: httpStatus.NOT_FOUND, data: {} })
    );
  }
  if (action === "dismiss") {
    row.status = "dismissed";
  } else if (action === "accept" || action === "edit") {
    row.status = action === "edit" ? "edited" : "accepted";
    row.acceptedOutcome = outcome || row.suggestion?.outcome || null;
    row.acceptedNote = note || "";
    if (amount != null) row.acceptedAmount = Number(amount);
  } else {
    return res.status(httpStatus.BAD_REQUEST).json(
      response({ message: "action must be accept, edit, or dismiss", status: "ERROR", statusCode: httpStatus.BAD_REQUEST, data: {} })
    );
  }
  await row.save();
  res.status(httpStatus.OK).json(
    response({ message: "Feedback saved", status: "OK", statusCode: httpStatus.OK, data: row })
  );
});

module.exports = { getContext, getStatus, postSuggest, postFeedback };
