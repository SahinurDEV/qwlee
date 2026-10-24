const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const get = async (path) => {
  const res = await fetch(`${API}/v1${path}`);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes };
};

test("gig reviews filter by star and sort", async () => {
  const all = await get("/reviews?limit=50");
  assert.equal(all.status, 200);
  const first = all.data.results.find((r) => r.gigId);
  assert.ok(first, "seed has gig reviews");
  const gigId = String(first.gigId?._id || first.gigId?.id || first.gigId);

  const summary = await get(`/reviews/summary?gigId=${gigId}`);
  for (const n of [5, 4, 3, 2, 1]) {
    const r = await get(`/reviews?gigId=${gigId}&rating=${n}&limit=50`);
    assert.equal(r.status, 200);
    assert.ok(r.data.results.every((x) => Math.round(x.rating) === n));
    assert.equal(r.data.totalResults, summary.data.histogram[n], `count for ${n} stars matches the histogram`);
  }

  const low = await get(`/reviews?gigId=${gigId}&sort=lowest&limit=50`);
  const ratings = low.data.results.map((x) => x.rating);
  assert.deepEqual(ratings, [...ratings].sort((a, b) => a - b));
  assert.equal((await get(`/reviews?gigId=${gigId}&sort=bogus`)).status, 400);
  assert.ok((await get(`/reviews?gigId=${gigId}&limit=500`)).data.results.length <= 50);
});
