const httpStatus = require("http-status");
const ApiError = require("../../utils/ApiError");
const { maskContact } = require("../risk.service");
const { Categories } = require("../../models");

function enabled() {
  return String(process.env.AI_SEARCH_ASSISTANT || process.env.AI_DISPUTE_ASSISTANT || "on").toLowerCase() !== "off";
}
function serviceUrl() {
  return (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
}
function hasKey() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_URL);
}

async function parseQuery(rawQuery) {
  if (!enabled()) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI search is turned off");
  const url = serviceUrl();
  if (!url) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI service URL is not configured");
  const query = maskContact(String(rawQuery || "").trim());
  if (query.length < 2) throw new ApiError(httpStatus.BAD_REQUEST, "Enter a search");

  const cats = await Categories.find({}).select("name").limit(40).lean();
  const names = cats.map((c) => c.name).filter(Boolean);

  try {
    const r = await fetch(`${url}/v1/search-parse`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
      },
      body: JSON.stringify({ query, categories: names, mock: !hasKey() }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || `AI ${r.status}`);
    return {
      parse: j.parse,
      source: j.source,
      model: j.model,
      latencyMs: j.latencyMs,
      configured: j.configured,
      fallback: false,
    };
  } catch (e) {
    // Fall back: treat whole query as title keywords
    return {
      parse: {
        keywords: query,
        categoryHint: "",
        maxPrice: null,
        minPrice: null,
        sortBy: "",
        explanation: "AI unavailable — using normal text search.",
      },
      source: "fallback",
      model: "",
      latencyMs: 0,
      configured: hasKey(),
      fallback: true,
      error: e.message,
    };
  }
}

/** Attach short "why this matched" lines for UI cards. */
function matchReasons(gig, parse) {
  const reasons = [];
  const title = `${gig.title || ""} ${(gig.searchTags || []).join(" ")}`.toLowerCase();
  const kw = String(parse?.keywords || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const hits = kw.filter((w) => title.includes(w)).slice(0, 3);
  if (hits.length) reasons.push(`Matches “${hits.join(", ")}”`);
  if (parse?.maxPrice != null && Number(gig.price) <= Number(parse.maxPrice)) {
    reasons.push(`Price $${Number(gig.price)} ≤ $${Number(parse.maxPrice)}`);
  }
  if (parse?.categoryHint) reasons.push(`In ${parse.categoryHint}`);
  if (!reasons.length) reasons.push("Related to your search");
  return reasons;
}

module.exports = { parseQuery, matchReasons, enabled, hasKey };
