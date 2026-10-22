const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const get = async (path) => {
  const r = await fetch(`${API}/v1${path}`);
  const j = await r.json().catch(() => null);
  return { status: r.status, data: j?.data?.attributes ?? j?.data };
};

test("reviews are public and never leak private user fields", async () => {
  const r = await get("/reviews?limit=5");
  assert.equal(r.status, 200);
  assert.ok(r.data.results.length > 0);
  for (const rv of r.data.results) {
    for (const who of [rv.userId, rv.freelancerId]) {
      for (const k of ["email", "balance", "verification", "banReason", "levelOverride", "twoFactorEnabled"]) assert.equal(who?.[k], undefined, `review user leaks ${k}`);
    }
  }
});

test("review summary: average, histogram and sub-rating breakdown", async () => {
  const any = (await get("/reviews?limit=1")).data.results[0];
  const gigId = any.gigId?._id || any.gigId?.id || any.gigId;
  const s = await get(`/reviews/summary?gigId=${gigId}`);
  assert.equal(s.status, 200);
  assert.ok(s.data.count >= 1);
  assert.ok(s.data.average >= 1 && s.data.average <= 5);
  assert.equal(Object.values(s.data.histogram).reduce((a, b) => a + b, 0), s.data.count);
  assert.ok(s.data.breakdown.communication >= 1, "seeded sub-ratings aggregated");
  assert.equal((await get("/reviews/summary")).status, 400);
});
