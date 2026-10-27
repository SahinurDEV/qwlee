#!/usr/bin/env node
const cases = [
  { stats: { openDisputes: 3, openRiskFlags: 5, aiEscalatedTickets: 2, ordersLast7d: 40 }, expectWarn: true },
  { stats: { openDisputes: 0, openRiskFlags: 0, aiEscalatedTickets: 0, ordersLast7d: 12 }, expectWarn: false },
  { stats: { openDisputes: 1, openRiskFlags: 0, aiEscalatedTickets: 0, ordersLast7d: 0 }, expectWarn: true },
];
const url = (process.env.AI_DISPUTE_URL || "http://127.0.0.1:7190").replace(/\/+$/, "");
const token = process.env.AI_DISPUTE_TOKEN || "local-ai-dispute-token-change-me";
(async () => {
  let ok = 0;
  for (const c of cases) {
    const r = await fetch(`${url}/v1/insights`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({ stats: c.stats, mock: true }),
    });
    const j = await r.json();
    const bullets = j.insights?.bullets || [];
    const hasWarn = bullets.some((b) => b.tone === "warn");
    const pass = r.ok && bullets.length >= 2 && hasWarn === c.expectWarn;
    if (pass) ok++;
    console.log(`${pass ? "OK" : "MISS"}\twarn=${hasWarn}\t${j.insights?.summary?.slice(0, 60)}`);
  }
  console.log(`\naccuracy=${((ok / cases.length) * 100).toFixed(1)}% (${ok}/${cases.length}) mode=mock`);
  process.exit(ok === cases.length ? 0 : 1);
})();
