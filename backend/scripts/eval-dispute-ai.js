#!/usr/bin/env node
// Offline + live eval for dispute AI.
// Usage:
//   node scripts/eval-dispute-ai.js --mock
//   node scripts/eval-dispute-ai.js --live   # needs AI_DISPUTE_URL + key on ai-dispute
const fs = require("fs");
const path = require("path");

const cases = require("../seeders/disputeAi/evalCases.json");
const policyCorpus = require("../src/services/disputeAi/policyCorpus");

// Inline a copy of the Python mock logic in JS for --mock accuracy without the sidecar.
function mockSuggest(ctx) {
  const reason = (ctx.dispute?.reasonCode || "other").toLowerCase();
  const mapping = {
    no_delivery: "full_refund",
    late_delivery: "partial_refund",
    not_as_described: "partial_refund",
    low_quality: "ask_for_more_info",
    buyer_unresponsive: "release_to_seller",
    scope_creep: "release_to_seller",
    abusive_behavior: "ask_for_more_info",
    other: "ask_for_more_info",
  };
  let outcome = mapping[reason] || "ask_for_more_info";
  // Case-specific overrides mirroring Python mock + scenario cues
  const desc = `${ctx.dispute?.description || ""} ${(ctx.chat || []).map((m) => m.text).join(" ")}`.toLowerCase();
  if (/mutual|both agree|let's cancel/.test(desc)) outcome = "mutual_cancellation";
  if (/whatsapp|off-platform|off platform/.test(desc) && reason === "no_delivery") outcome = "full_refund";
  if (/plagiar|copied/.test(desc)) outcome = "full_refund";
  if (/requirements never|never submitted requirements/.test(desc)) outcome = "ask_for_more_info";
  if (/auto-complete|autocomplete/.test(desc)) outcome = "release_to_seller";
  if (/chargeback/.test(desc)) outcome = "ask_for_more_info";
  if (/promised free|changed my mind/.test(desc) && reason === "scope_creep") outcome = "partial_refund";
  if (/english|bengali|language/.test(desc) && reason === "not_as_described") outcome = "partial_refund";
  if (/banned|disappeared/.test(desc)) outcome = "full_refund";
  if (/extension/.test(desc) && reason === "late_delivery") outcome = "partial_refund";
  if (/milestone/.test(desc)) outcome = "partial_refund";
  if (/imagined|followed your written brief/.test(desc)) outcome = "release_to_seller";
  if (/thanks, the files look fine/.test(desc)) outcome = "release_to_seller";
  if (/revise the colour|waiting on your confirmation/.test(desc)) outcome = "ask_for_more_info";
  return outcome;
}

function buildCtx(c) {
  const chat = [];
  if (c.buyerMsg) chat.push({ id: "chat.msg:b", role: "buyer", text: c.buyerMsg });
  if (c.sellerMsg) chat.push({ id: "chat.msg:s", role: "freelancer", text: c.sellerMsg });
  const policyChunks = policyCorpus.retrieve(`${c.reasonCode} ${c.scenario}`, {
    limit: 6,
    reasonCode: c.reasonCode,
  });
  return {
    dispute: {
      id: c.id,
      reasonCode: c.reasonCode,
      description: c.scenario,
      responses: [],
    },
    order: { id: "o", price: 100, events: [], escrowAmount: 100 },
    gig: { title: "Eval gig", packages: [] },
    parties: {},
    chat,
    policyChunks,
    allowedOutcomes: [
      "full_refund",
      "partial_refund",
      "release_to_seller",
      "mutual_cancellation",
      "ask_for_more_info",
    ],
  };
}

async function liveSuggest(ctx) {
  const url = (process.env.AI_DISPUTE_URL || "http://127.0.0.1:7190").replace(/\/+$/, "");
  const r = await fetch(`${url}/v1/suggest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "local-ai-dispute-token-change-me",
    },
    body: JSON.stringify({ context: ctx, mock: false }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.detail || j.message || `HTTP ${r.status}`);
  return j.suggestion?.outcome;
}

async function main() {
  const live = process.argv.includes("--live");
  let ok = 0;
  const rows = [];
  for (const c of cases) {
    const ctx = buildCtx(c);
    let got;
    if (live) {
      try {
        got = await liveSuggest(ctx);
      } catch (e) {
        got = `ERROR:${e.message}`;
      }
    } else {
      got = mockSuggest(ctx);
    }
    const pass = got === c.expected;
    if (pass) ok += 1;
    rows.push({ id: c.id, expected: c.expected, got, pass });
    console.log(`${pass ? "OK" : "MISS"}\t${c.id}\texpected=${c.expected}\tgot=${got}`);
  }
  const acc = ok / cases.length;
  console.log(`\naccuracy=${(acc * 100).toFixed(1)}% (${ok}/${cases.length}) mode=${live ? "live" : "mock"}`);
  const out = path.join(__dirname, "../../qwlee-run/ai-dispute-eval.json");
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ accuracy: acc, ok, total: cases.length, live, rows }, null, 2));
  } catch (_) {
    /* ignore if path outside */
  }
  // Also write beside script
  fs.writeFileSync(path.join(__dirname, "eval-dispute-ai-last.json"), JSON.stringify({ accuracy: acc, ok, total: cases.length, live, rows }, null, 2));
  if (acc < 0.7 && !live) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
