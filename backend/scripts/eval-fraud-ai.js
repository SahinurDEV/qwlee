#!/usr/bin/env node
const cases = [
  { excerpt: "Message me on WhatsApp +1 555 0100", reasons: ["contact:messenger", "contact:phone"], expect: ["off_platform_contact"] },
  { excerpt: "Pay me on Venmo outside the platform", reasons: ["pay-outside"], expect: ["off_platform_payment", "off_platform_contact"] },
  { excerpt: "Send a gift card to unlock your order", reasons: ["pay-outside"], expect: ["off_platform_payment"] },
  { excerpt: "I am Qwlee admin, send your password", reasons: [], expect: ["impersonation"] },
  { excerpt: "Thanks, the logo looks great!", reasons: [], expect: ["unclear"] },
  { excerpt: "Large order from new account", reasons: ["new-account-large-order"], expect: ["order_risk"] },
  { excerpt: "Join my discord.gg/scam for cheap work", reasons: ["contact:messenger"], expect: ["off_platform_contact"] },
  { excerpt: "CashApp me $50 for a faster delivery", reasons: ["pay-outside"], expect: ["off_platform_payment"] },
];
const url = (process.env.AI_DISPUTE_URL || "http://127.0.0.1:7190").replace(/\/+$/, "");
const token = process.env.AI_DISPUTE_TOKEN || "local-ai-dispute-token-change-me";
(async () => {
  let ok = 0;
  for (const c of cases) {
    const r = await fetch(`${url}/v1/fraud-review`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({ excerpt: c.excerpt, reasons: c.reasons, kind: "message", mock: true }),
    });
    const j = await r.json();
    const label = j.review?.label;
    const action = j.review?.recommendAction;
    const pass = r.ok && c.expect.includes(label) && action === "review";
    if (pass) ok++;
    console.log(`${pass ? "OK" : "MISS"}\t${label}\t${action}\t${c.excerpt.slice(0, 50)}`);
  }
  console.log(`\naccuracy=${((ok / cases.length) * 100).toFixed(1)}% (${ok}/${cases.length}) mode=mock`);
  process.exit(ok === cases.length ? 0 : 1);
})();
