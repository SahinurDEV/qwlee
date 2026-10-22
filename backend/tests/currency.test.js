const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");

test("currencies: USD base with rates for every listed currency", async () => {
  const r = await fetch(`${API}/v1/info/currencies`).then((x) => x.json());
  const d = r.data.attributes;
  assert.equal(d.base, "USD");
  assert.equal(d.rates.USD, 1);
  assert.ok(Object.keys(d.rates).length >= 2);
  for (const v of Object.values(d.rates)) assert.ok(v > 0);
  assert.ok(["live", "fallback"].includes(d.source));
});

test("currency service: live source parsed, bad source falls back", async () => {
  const svc = require("../src/services/currency.service");
  process.env.FX_RATES_URL = "https://fx.example/latest";
  const live = await svc.load(async () => ({ json: async () => ({ rates: { USD: 1, EUR: 0.9, BDT: 121.5, XXX: 3 } }) }));
  assert.equal(live.source, "live");
  assert.equal(live.rates.EUR, 0.9);
  assert.equal(live.rates.XXX, undefined, "only supported currencies");
  const broken = await svc.load(async () => ({ json: async () => ({ nope: true }) }));
  assert.equal(broken.source, "fallback");
  const down = await svc.load(async () => { throw new Error("down"); });
  assert.equal(down.source, "fallback");
  assert.equal(down.rates.USD, 1);
  delete process.env.FX_RATES_URL;
});
