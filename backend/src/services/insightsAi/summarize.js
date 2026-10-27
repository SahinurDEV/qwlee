const { Dispute, RiskFlag, SupportTicket, Payment } = require("../../models");

function enabled() {
  return String(process.env.AI_INSIGHTS_ASSISTANT || process.env.AI_DISPUTE_ASSISTANT || "on").toLowerCase() !== "off";
}
function serviceUrl() {
  return (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
}
function hasKey() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_URL);
}

async function collectStats() {
  const since = new Date(Date.now() - 7 * 86400000);
  const [openDisputes, openRiskFlags, aiEscalatedTickets, ordersLast7d] = await Promise.all([
    Dispute.countDocuments({ status: { $in: ["open", "awaiting_response", "escalated"] } }),
    RiskFlag.countDocuments({ status: "open" }),
    SupportTicket.countDocuments({ aiEscalated: true, status: { $ne: "closed" } }),
    Payment.countDocuments({ createdAt: { $gte: since } }),
  ]);
  return { openDisputes, openRiskFlags, aiEscalatedTickets, ordersLast7d };
}

async function summarize({ mock = false } = {}) {
  if (!enabled()) {
    const err = new Error("AI insights is turned off");
    err.statusCode = 503;
    throw err;
  }
  const url = serviceUrl();
  if (!url) {
    const err = new Error("AI service URL is not configured");
    err.statusCode = 503;
    throw err;
  }
  const stats = await collectStats();
  const r = await fetch(`${url}/v1/insights`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
    },
    body: JSON.stringify({ stats, mock: mock || !hasKey() }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.detail || j.message || `AI ${r.status}`);
    err.statusCode = r.status === 503 ? 503 : 502;
    throw err;
  }
  return {
    stats,
    insights: j.insights,
    source: j.source,
    model: j.model,
    latencyMs: j.latencyMs,
    configured: j.configured,
  };
}

module.exports = { summarize, collectStats, enabled, hasKey };
