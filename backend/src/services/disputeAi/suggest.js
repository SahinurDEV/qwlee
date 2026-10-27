const httpStatus = require("http-status");
const crypto = require("crypto");
const ApiError = require("../../utils/ApiError");
const { assembleContext } = require("./assembleContext");
const { DisputeAiSuggestion } = require("../../models");

const enabled = () => String(process.env.AI_DISPUTE_ASSISTANT || "on").toLowerCase() !== "off";
const serviceUrl = () => (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
const hasKey = () => Boolean(process.env.AI_API_KEY && process.env.AI_API_URL);

const status = () => ({
  enabled: enabled(),
  configured: hasKey() && Boolean(serviceUrl()),
  provider: (process.env.AI_API_URL || "").includes("openrouter.ai") ? "openrouter" : hasKey() ? "openai-compatible" : "none",
  model: process.env.AI_MODEL || "",
  service: Boolean(serviceUrl()),
});

async function suggest(adminId, disputeId, { mock = false } = {}) {
  if (!enabled()) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Dispute AI assistant is turned off");
  const url = serviceUrl();
  if (!url) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI dispute service URL is not configured");

  const context = await assembleContext(disputeId);
  const promptHash = crypto.createHash("sha256").update(JSON.stringify(context)).digest("hex").slice(0, 24);

  // Cache hit (15 min) for same content hash
  const cached = await DisputeAiSuggestion.findOne({
    disputeId,
    promptHash,
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).sort({ createdAt: -1 });
  if (cached && !mock) {
    return {
      suggestion: cached.suggestion,
      source: cached.source,
      model: cached.model,
      latencyMs: cached.latencyMs,
      configured: status().configured,
      cached: true,
      suggestionId: String(cached._id),
    };
  }

  if (!hasKey() && !mock) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "AI not configured. Set AI_API_KEY (OpenRouter) plus AI_API_URL and AI_MODEL."
    );
  }

  const t0 = Date.now();
  let remote;
  try {
    const r = await fetch(`${url}/v1/suggest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
      },
      body: JSON.stringify({ context, mock: mock || !hasKey() }),
      signal: AbortSignal.timeout(60000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = j?.detail || j?.message || `AI service error ${r.status}`;
      throw new ApiError(r.status === 503 ? httpStatus.SERVICE_UNAVAILABLE : httpStatus.BAD_GATEWAY, String(detail));
    }
    remote = j;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(httpStatus.BAD_GATEWAY, `AI dispute service unreachable: ${e.message}`);
  }

  const row = await DisputeAiSuggestion.create({
    disputeId,
    adminId,
    promptHash,
    model: remote.model || "",
    source: remote.source || "remote",
    latencyMs: remote.latencyMs || Date.now() - t0,
    suggestion: remote.suggestion,
    status: "suggested",
  });

  return {
    suggestion: remote.suggestion,
    source: remote.source,
    model: remote.model,
    latencyMs: remote.latencyMs,
    configured: status().configured,
    cached: false,
    suggestionId: String(row._id),
  };
}

module.exports = { suggest, status, enabled };
