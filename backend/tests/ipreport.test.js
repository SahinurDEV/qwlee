// Intellectual property reports go through support with their own category.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

test("support accepts an intellectual property report", async () => {
  const l = await call("POST", "/auth/login", { body: { email: "buyer@example.com", password: "Buyer123!" } });
  const token = l.json.data.attributes.tokens.access.token;
  const r = await call("POST", "/support/tickets", { token, body: { subject: "My photo is used in a gig", category: "ip", body: "I own the photo at the link below and did not license it. This report is accurate and made in good faith." } });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.json));
  assert.match(JSON.stringify(r.json), /"category":"ip"/);
});
