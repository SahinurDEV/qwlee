const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const get = async (path) => {
  const res = await fetch(`${API}/v1${path}`);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes };
};

test("language filter matches any language a seller lists", async () => {
  const all = await get("/gig?limit=50");
  const langs = new Set();
  for (const g of all.data.results) String(g.userId?.language || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((l) => langs.add(l));
  const second = [...langs].find((l) => l !== "English");
  assert.ok(second, "seed has a seller with a second language");
  const r = await get(`/gig?language=${encodeURIComponent(second)}&limit=50`);
  assert.equal(r.status, 200);
  assert.ok(r.data.results.length > 0, `gigs for sellers speaking ${second}`);
  for (const g of r.data.results) {
    assert.match(String(g.userId?.language), new RegExp(`(^|,)\\s*${second}\\s*(,|$)`, "i"));
  }
  // Partial words don't match ("Span" is not "Spanish").
  assert.equal((await get(`/gig?language=${encodeURIComponent(second.slice(0, 3))}&limit=50`)).data.results.length, 0);
});
