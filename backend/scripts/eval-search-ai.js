#!/usr/bin/env node
const cases = [
  { q: "logo for my bakery under $50", cat: "Graphic Design", max: 50 },
  { q: "wordpress website under 100", cat: "Web Development", max: 100 },
  { q: "figma ui kit", cat: "UI/UX Design", max: null },
  { q: "youtube video editing", cat: "Video Editing", max: null },
  { q: "seo for ecommerce", cat: "Digital Marketing", max: null },
  { q: "chatgpt prompt engineer", cat: "AI Services", max: null },
  { q: "android app under $200", cat: "Mobile Development", max: 200 },
  { q: "xyzzy nonsense", cat: "", max: null },
];
const url = (process.env.AI_DISPUTE_URL || "http://127.0.0.1:7190").replace(/\/+$/, "");
const token = process.env.AI_DISPUTE_TOKEN || "local-ai-dispute-token-change-me";
(async () => {
  let ok = 0;
  for (const c of cases) {
    const r = await fetch(`${url}/v1/search-parse`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({
        query: c.q,
        categories: ["Graphic Design","Web Development","UI/UX Design","Video Editing","Digital Marketing","AI Services","Mobile Development"],
        mock: true,
      }),
    });
    const j = await r.json();
    const p = j.parse || {};
    const catOk = !c.cat || p.categoryHint === c.cat;
    const priceOk = c.max == null || Number(p.maxPrice) === c.max;
    const pass = r.ok && catOk && priceOk;
    if (pass) ok++;
    console.log(`${pass ? "OK" : "MISS"}\t${c.q}\tcat=${p.categoryHint}\tmax=${p.maxPrice}`);
  }
  console.log(`\naccuracy=${((ok / cases.length) * 100).toFixed(1)}% (${ok}/${cases.length}) mode=mock`);
  process.exit(ok === cases.length ? 0 : 1);
})();
