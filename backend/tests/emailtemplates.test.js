const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

const MP = (process.env.MAILPIT_URL || "http://localhost:8025").replace(/\/+$/, "");

test("email templates: preview, save with escaped variables, test send, reset", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  assert.equal((await call("GET", "/admin/email-templates", { token: fin.token })).status, 403);
  const l = await call("GET", "/admin/email-templates", { token: sup.token });
  assert.equal(l.status, 200);
  const t = l.data.results.find((x) => x.key === "sendOrderConfirmedBuyer");
  assert.ok(t && t.variables.includes("buyerName") && t.canDisable);
  assert.equal(l.data.results.find((x) => x.key === "sendResetPasswordEmail").canDisable, false);
  assert.equal((await call("PUT", "/admin/email-templates/sendResetPasswordEmail", { token: sup.token, body: { disabled: true } })).status, 400);
  assert.equal((await call("PUT", "/admin/email-templates/nope", { token: sup.token, body: {} })).status, 404);
  const draft = { subject: "Hey {{buyerName}}: {{subject}}", heroTitle: "Thanks {{buyerName}} <b>", intro: "Order for {{gigTitle}} <script>x</script>", ctaLabel: "See it" };
  const p = await call("POST", "/admin/email-templates/sendOrderConfirmedBuyer/preview", { token: sup.token, body: { draft } });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  assert.match(p.data.builtIn.subject, /^Order placed/);
  assert.equal(p.data.custom.subject, "Hey Alex: Order placed — Modern logo design");
  assert.ok(p.data.custom.html.includes("Thanks Alex &lt;b&gt;"));
  assert.ok(p.data.custom.html.includes("&lt;script&gt;") && !p.data.custom.html.includes("<script>"));
  assert.ok(p.data.custom.html.includes(">See it<"));
  try {
    assert.equal((await call("PUT", "/admin/email-templates/sendOrderConfirmedBuyer", { token: sup.token, body: draft })).status, 200);
    const sent = await call("POST", "/admin/email-templates/sendOrderConfirmedBuyer/test", { token: sup.token });
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
    let found;
    for (let i = 0; i < 40 && !found; i++) {
      const r = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent('subject:"[Test] Hey Alex"')}&limit=1`)).json().catch(() => ({}));
      found = r.messages?.[0];
      if (!found) await new Promise((res) => setTimeout(res, 250));
    }
    if (sent.data.sent) assert.ok(found, "test email delivered");
  } finally {
    assert.equal((await call("DELETE", "/admin/email-templates/sendOrderConfirmedBuyer", { token: sup.token })).status, 200);
  }
  const after = (await call("GET", "/admin/email-templates", { token: sup.token })).data.results.find((x) => x.key === "sendOrderConfirmedBuyer");
  assert.equal(after.override, null);
});
