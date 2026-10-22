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

const bank = async (token, amt, acct) => {
  const w = await call("POST", "/withdrawal", { token, body: { withdrawalAmount: amt, bankName: "Test Bank", accountNumber: acct, accountType: "Savings" } });
  assert.equal(w.status, 201, JSON.stringify(w.json));
  const d = w.data?.withdrawal || w.data;
  return String(d._id || d.id);
};
const getW = async (fin, id) => (await call("GET", `/withdrawal/single?withdrawalId=${id}`, { token: fin.token })).data;

test("payout batches: bank CSV export, batch approve and reconciliation", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const fin = await login("finance@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const a = await bank(seller.token, 20, "=HYPERLINK(1)");
  const b = await bank(seller.token, 21, "ACC-B");
  const c = await bank(seller.token, 22, "ACC-C");

  // Export: finance only, pending bank rows, formula cells defused.
  assert.equal((await fetch(`${API}/v1/withdrawal/export/bank.csv`, { headers: { authorization: `Bearer ${mod.token}` } })).status, 403);
  const ex = await fetch(`${API}/v1/withdrawal/export/bank.csv`, { headers: { authorization: `Bearer ${fin.token}` } });
  assert.equal(ex.status, 200);
  assert.match(ex.headers.get("content-type"), /text\/csv/);
  const csv = await ex.text();
  assert.match(csv.split("\n")[0], /^reference,requested_at,name,email,bank_name,account_number,account_type,amount_usd$/);
  for (const id of [a, b, c]) assert.ok(csv.includes(id), `export has ${id}`);
  assert.ok(csv.includes("'=HYPERLINK(1)"), "formula escaped");

  // Batch approve: a is approved, junk ids are reported, not fatal.
  assert.equal((await call("POST", "/withdrawal/batch/approve", { token: mod.token, body: { ids: [a] } })).status, 403);
  assert.equal((await call("POST", "/withdrawal/batch/approve", { token: fin.token, body: { ids: [] } })).status, 400);
  const bt = await call("POST", "/withdrawal/batch/approve", { token: fin.token, body: { ids: [a, a, "nope", "64b000000000000000000000"] } });
  assert.equal(bt.status, 200, JSON.stringify(bt.json));
  assert.equal(bt.data.approved, 1);
  assert.equal(bt.data.failed, 2);
  assert.equal((await getW(fin, a)).status, "Completed");
  const again = await call("POST", "/withdrawal/batch/approve", { token: fin.token, body: { ids: [a] } });
  assert.match(again.data.results[0].error, /Status is Completed/);

  // Reconcile: a (already approved) matches, b is paid and gets approved,
  // c has the wrong amount, an unknown reference is reported.
  const stmt = `reference,amount,status,bank_reference\n${a},20.00,paid,BNK-A\n"${b}","$21.00",paid,BNK-B\n${c},99,paid,BNK-C\n64b000000000000000000000,5,paid,X\n`;
  const dry = await call("POST", "/withdrawal/reconcile", { token: fin.token, body: { csv: stmt, dryRun: true } });
  assert.equal(dry.status, 200, JSON.stringify(dry.json));
  assert.deepEqual(dry.data.summary, { "would-match": 1, "would-approve": 1, "amount-mismatch": 1, unknown: 1 });
  assert.equal((await getW(fin, b)).status, "Pending", "dry run changes nothing");
  const rec = await call("POST", "/withdrawal/reconcile", { token: fin.token, body: { csv: stmt } });
  assert.deepEqual(rec.data.summary, { matched: 1, approved: 1, "amount-mismatch": 1, unknown: 1 });
  const wb = await getW(fin, b);
  assert.equal(wb.status, "Completed");
  assert.equal(wb.payout.id, "BNK-B");
  assert.ok(wb.reconciledAt);
  const rec2 = await call("POST", "/withdrawal/reconcile", { token: fin.token, body: { csv: stmt } });
  assert.equal(rec2.data.summary["already-reconciled"], 2, "idempotent");
  assert.equal((await call("POST", "/withdrawal/reconcile", { token: fin.token, body: { csv: "foo,bar\n1,2" } })).status, 400);

  // Clean up: decline c so the seller gets the money back.
  assert.equal((await call("PATCH", `/withdrawal/${c}`, { token: fin.token, body: { reason: "test" } })).status, 200);
});

test("payout batches: CSV parser handles quotes and CRLF", () => {
  const { parseCsv } = require("../src/services/payoutBatch.service");
  assert.deepEqual(parseCsv('a,b\r\n"x, ""y""",2\r\n\r\n'), [["a", "b"], ['x, "y"', "2"]]);
});
