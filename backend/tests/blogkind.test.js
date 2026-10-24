const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const get = async (path) => {
  const res = await fetch(`${API}/v1${path}`);
  return { status: res.status, data: (await res.json())?.data?.attributes };
};

test("blog list filters articles and guides", async () => {
  const all = await get("/blog?limit=100");
  const guides = await get("/blog?kind=guide&limit=100");
  const articles = await get("/blog?kind=article&limit=100");
  assert.equal(guides.status, 200);
  assert.ok(guides.data.results.every((b) => b.kind === "guide"));
  assert.ok(articles.data.results.every((b) => b.kind !== "guide"));
  assert.equal(guides.data.totalResults + articles.data.totalResults, all.data.totalResults);
});
