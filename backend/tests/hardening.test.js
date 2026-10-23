// Phase A hardening: regex filters are escaped and public page size is capped.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (path, token) => {
  const res = await fetch(`${API}/v1${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};
const adminToken = async () => {
  const r = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "Admin123!" }),
  });
  const j = await r.json();
  return (j.data?.attributes ?? j.data)?.tokens?.access?.token;
};

test("admin regex filters treat input literally (no 500 on bad patterns)", async () => {
  const t = await adminToken();
  for (const bad of ["(a+)+$", "[", "*"]) {
    const q = encodeURIComponent(bad);
    assert.equal((await call(`/admin/searches?search=${q}`, t)).status, 200, `searches ${bad}`);
    assert.equal((await call(`/admin/gigs?title=${q}`, t)).status, 200, `gigs ${bad}`);
  }
});

test("public gig list caps ?limit at 100", async () => {
  const r = await call("/gig?limit=100000");
  assert.equal(r.status, 200);
  const d = r.json?.data?.attributes ?? r.json?.data ?? r.json;
  const limit = d?.limit ?? d?.pagination?.limit;
  if (limit !== undefined) assert.ok(Number(limit) <= 100, `limit ${limit}`);
});
