#!/usr/bin/env node
/** Offline mock eval for AI support answers (no live DB, no live LLM). */
const path = require("path");
const cases = require("../seeders/supportAi/evalCases.json");
const policyCorpus = require("../src/services/disputeAi/policyCorpus");

// Use Python mock via HTTP if available, else local keyword parity check via retrieve only.
async function main() {
  const url = (process.env.AI_DISPUTE_URL || "http://127.0.0.1:7190").replace(/\/+$/, "");
  const token = process.env.AI_DISPUTE_TOKEN || "local-ai-dispute-token-change-me";
  let ok = 0;
  for (const c of cases) {
    const policyChunks = policyCorpus.retrieve(c.question, { limit: 8 });
    let ans;
    try {
      const r = await fetch(`${url}/v1/support-answer`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Internal-Token": token },
        body: JSON.stringify({ question: c.question, policyChunks, mock: true }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || r.status);
      ans = j.answer;
    } catch (e) {
      console.log(`FAIL\t${c.id}\t${e.message}`);
      continue;
    }
    const escOk = Boolean(ans.escalate) === Boolean(c.expectEscalate);
    const docOk =
      !c.expectDoc ||
      (ans.citations || []).some((x) => String(x.source).includes(c.expectDoc));
    const pass = escOk && docOk;
    if (pass) ok += 1;
    console.log(
      `${pass ? "OK" : "MISS"}\t${c.id}\tescalate=${ans.escalate}\tconf=${ans.confidence}\tcites=${(ans.citations || []).map((x) => x.source).join(",")}`
    );
  }
  const pct = ((ok / cases.length) * 100).toFixed(1);
  console.log(`\naccuracy=${pct}% (${ok}/${cases.length}) mode=mock`);
  process.exit(ok === cases.length ? 0 : 1);
}

main();
