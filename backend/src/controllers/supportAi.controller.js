const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const supportAi = require("../services/supportAi/ask");

const ask = catchAsync(async (req, res) => {
  const result = await supportAi.ask(req.user, {
    question: req.body?.question,
    audience: req.body?.audience || (req.user?.role === "freelancer" ? "seller" : "buyer"),
    escalate: Boolean(req.body?.escalate),
  });
  res.status(httpStatus.OK).send({ code: 200, message: "AI support answer", data: { attributes: result } });
});

const status = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).send({
    code: 200,
    message: "AI support status",
    data: {
      attributes: {
        enabled: supportAi.enabled(),
        configured: supportAi.hasKey(),
        confidenceThreshold: supportAi.CONF_THRESHOLD,
        rateLimitPerHour: supportAi.RATE_MAX,
      },
    },
  });
});

module.exports = { ask, status };
