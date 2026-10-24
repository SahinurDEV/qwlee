const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const get = async (path) => {
  const res = await fetch(`${API}/v1${path}`);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes };
};

test("gig page related rows", async () => {
  const list = await get("/gig?limit=50");
  assert.equal(list.status, 200);
  const bySeller = {};
  for (const g of list.data.results) {
    const s = String(g.userId?._id || g.userId?.id || g.userId);
    (bySeller[s] = bySeller[s] || []).push(g);
  }
  const gig = Object.values(bySeller).find((a) => a.length > 1)?.[0] || list.data.results[0];
  const id = String(gig._id || gig.id);
  const sellerId = String(gig.userId?._id || gig.userId?.id || gig.userId);
  const r = await get(`/gig/${id}/related`);
  assert.equal(r.status, 200);
  for (const g of r.data.moreFromSeller) {
    assert.equal(String(g.userId?._id || g.userId?.id || g.userId), sellerId);
    assert.notEqual(String(g._id || g.id), id);
    assert.equal(g.userId.password, undefined);
    assert.equal(g.userId.email, undefined);
  }
  assert.equal((await get("/gig/000000000000000000000000/related")).status, 404);
  assert.equal((await get("/gig/nope/related")).status, 404);
});
