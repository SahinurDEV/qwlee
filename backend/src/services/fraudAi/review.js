function enabled() {
  return String(process.env.AI_FRAUD_ASSISTANT || process.env.AI_DISPUTE_ASSISTANT || "on").toLowerCase() !== "off";
}
function serviceUrl() {
  return (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
}
function hasKey() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_URL);
}

/**
 * Second-pass LLM review for an already-opened RiskFlag.
 * Never changes status — only attaches ai* fields for moderators.
 */
async function reviewFlag(flag, { forceMock = false } = {}) {
  if (!enabled()) return null;
  const url = serviceUrl();
  if (!url) return null;
  const { maskContact } = require("../risk.service");
  const excerpt = maskContact(String(flag.excerpt || "").slice(0, 800));
  const reasons = Array.isArray(flag.reasons) ? flag.reasons : [];
  try {
    const r = await fetch(`${url}/v1/fraud-review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
      },
      body: JSON.stringify({
        excerpt,
        reasons,
        kind: flag.kind || "message",
        mock: forceMock || !hasKey(),
      }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    const review = j.review || {};
    return {
      aiLabel: String(review.label || "").slice(0, 64),
      aiConfidence: typeof review.confidence === "number" ? review.confidence : null,
      aiRationale: String(review.rationale || "").slice(0, 1000),
      aiEvidence: (review.evidence || []).slice(0, 5).map((e) => ({
        source: String(e.source || "").slice(0, 40),
        quote: String(e.quote || "").slice(0, 300),
        why: String(e.why || "").slice(0, 200),
      })),
      aiSource: j.source || "",
      aiModel: j.model || "",
      aiReviewedAt: new Date(),
    };
  } catch {
    return null;
  }
}

module.exports = { reviewFlag, enabled, hasKey };
