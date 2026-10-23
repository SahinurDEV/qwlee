// Job Success Score: pure scoring rules + public endpoint.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { score, classify } = require("../src/utils/jobSuccess");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const ago = (months) => new Date(Date.now() - months * 30.44 * 864e5).toISOString();

test("job success: outcome classes", () => {
  assert.equal(classify({ status: "delivered" }), "positive");
  assert.equal(classify({ status: "delivered", rating: 5 }), "positive");
  assert.equal(classify({ status: "delivered", rating: 3.5 }), "neutral");
  assert.equal(classify({ status: "delivered", rating: 2 }), "negative");
  assert.equal(classify({ status: "cancelled" }), "negative");
  assert.equal(classify({ status: "active" }), null);
});

test("job success: needs 5 outcomes, prefers the 6-month window, widens when short", () => {
  assert.equal(score([{ status: "delivered", closedAt: ago(1) }]).score, null);
  const recent = [...Array(4)].map(() => ({ status: "delivered", closedAt: ago(1) })).concat({ status: "cancelled", closedAt: ago(2) });
  assert.deepEqual([score(recent).score, score(recent).windowMonths], [80, 6]);
  const older = [{ status: "delivered", closedAt: ago(1) }, ...[...Array(4)].map(() => ({ status: "delivered", closedAt: ago(10) }))];
  assert.deepEqual([score(older).score, score(older).windowMonths], [100, 12]);
  const old = [...Array(5)].map(() => ({ status: "delivered", closedAt: ago(30) }));
  assert.equal(score(old).score, null, "older than 24 months is ignored");
});

test("job success endpoint is public and validates the id", async () => {
  assert.equal((await fetch(`${API}/v1/users/nope/job-success`)).status, 400);
  const gig = (await (await fetch(`${API}/v1/gig?limit=1`)).json()).data.attributes.results[0];
  const id = gig.userId?.id || gig.userId?._id || gig.userId;
  const r = await fetch(`${API}/v1/users/${id}/job-success`);
  assert.equal(r.status, 200);
  const d = (await r.json()).data.attributes;
  assert.ok(d.score === null || (d.score >= 0 && d.score <= 100));
  assert.equal(d.minOrders, 5);
});
