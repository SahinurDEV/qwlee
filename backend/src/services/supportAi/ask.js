const httpStatus = require("http-status");
const ApiError = require("../../utils/ApiError");
const { maskContact } = require("../risk.service");
const policyCorpus = require("../disputeAi/policyCorpus");
const { SupportTicket, SupportMessage } = require("../../models");

const CONF_THRESHOLD = 0.55;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;

// In-memory rate bucket per user (fine for single-box; resets on restart).
const buckets = new Map();

function enabled() {
  return String(process.env.AI_SUPPORT_ASSISTANT || process.env.AI_DISPUTE_ASSISTANT || "on").toLowerCase() !== "off";
}
function serviceUrl() {
  return (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
}
function hasKey() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_URL);
}

function assertRate(userId) {
  const key = String(userId);
  const now = Date.now();
  let b = buckets.get(key) || { reset: now + RATE_WINDOW_MS, count: 0 };
  if (now > b.reset) b = { reset: now + RATE_WINDOW_MS, count: 0 };
  b.count += 1;
  buckets.set(key, b);
  if (b.count > RATE_MAX) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, "AI support rate limit — try again in an hour");
  }
}

async function ask(user, { question, audience = "all", escalate = false } = {}) {
  if (!enabled()) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI support assistant is turned off");
  const url = serviceUrl();
  if (!url) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI dispute service URL is not configured");
  const q = maskContact(String(question || "").trim());
  if (q.length < 5) throw new ApiError(httpStatus.BAD_REQUEST, "Ask a slightly longer question");
  assertRate(user.id || user._id);

  const policyChunks = policyCorpus.retrieve(q, { limit: 8 }).map((c) => ({
    id: c.id,
    doc: c.doc,
    heading: c.heading,
    text: c.text,
  }));

  const mock = !hasKey();
  const r = await fetch(`${url}/v1/support-answer`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
    },
    body: JSON.stringify({ question: q, audience, policyChunks, mock }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = j?.detail || j?.message || `AI service error ${r.status}`;
    throw new ApiError(r.status === 503 ? httpStatus.SERVICE_UNAVAILABLE : httpStatus.BAD_GATEWAY, String(detail));
  }

  const answer = j.answer || {};
  const shouldEscalate = Boolean(escalate || answer.escalate || Number(answer.confidence) < CONF_THRESHOLD);
  let ticket = null;
  if (shouldEscalate) {
    const subject = (answer.draftTicketSubject || q).slice(0, 160);
    const body =
      answer.draftTicketBody ||
      `User question:\n${q}\n\nAI draft (confidence ${answer.confidence}):\n${answer.answer || ""}`;
    ticket = await SupportTicket.create({
      userId: user.id || user._id,
      participants: [user.id || user._id],
      openedBy: user.id || user._id,
      openedByRole: "user",
      subject,
      category: "other",
      status: "open",
      aiEscalated: true,
      aiConfidence: answer.confidence,
      aiCitations: answer.citations || [],
      aiDraftAnswer: answer.answer || "",
      aiSource: j.source || "",
      unreadByAdmin: 1,
      unreadByUser: 0,
    });
    await SupportMessage.create({
      ticketId: ticket._id,
      senderId: user.id || user._id,
      senderRole: "user",
      body: body.slice(0, 4000),
    });
  }

  try { require("../aiObservability/log").logAiCall({ feature: "support", source: j.source, model: j.model, latencyMs: j.latencyMs, ok: true }); } catch (_) {}
  return {
    answer: answer.answer || "",
    confidence: answer.confidence,
    citations: answer.citations || [],
    escalate: shouldEscalate,
    source: j.source,
    model: j.model,
    latencyMs: j.latencyMs,
    configured: j.configured,
    ticketId: ticket ? String(ticket._id) : null,
  };
}

module.exports = { ask, enabled, CONF_THRESHOLD, RATE_MAX, assertRate, hasKey };
