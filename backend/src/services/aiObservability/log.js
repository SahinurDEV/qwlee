const { AiCallLog } = require("../../models");

async function logAiCall({ feature, source = "", model = "", latencyMs = 0, ok = true, error = "" } = {}) {
  try {
    await AiCallLog.create({
      feature: String(feature || "dispute").slice(0, 32),
      source: String(source || "").slice(0, 40),
      model: String(model || "").slice(0, 80),
      latencyMs: Number(latencyMs) || 0,
      ok: Boolean(ok),
      error: String(error || "").slice(0, 300),
    });
  } catch (e) {
    // Never break the main request path for telemetry
    require("../../config/logger").warn(`ai call log skipped: ${e.message}`);
  }
}

async function list({ feature, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (feature) filter.feature = feature;
  return AiCallLog.paginate(filter, {
    sortBy: "createdAt:desc",
    page: Number(page) || 1,
    limit: Math.min(Number(limit) || 50, 200),
  });
}

async function summary({ hours = 24 } = {}) {
  const since = new Date(Date.now() - Number(hours) * 3600000);
  const rows = await AiCallLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { feature: "$feature", source: "$source" },
        count: { $sum: 1 },
        avgLatencyMs: { $avg: "$latencyMs" },
        errors: { $sum: { $cond: ["$ok", 0, 1] } },
      },
    },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return { hours: Number(hours), total, rows };
}

module.exports = { logAiCall, list, summary };
