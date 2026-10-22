// Display currencies. Every price is stored and charged in USD; buyers can
// view approximate prices in another currency. Rates come from FX_RATES_URL
// (any JSON with a `rates` object keyed by currency code, USD-based, such
// as https://open.er-api.com/v6/latest/USD) refreshed every 12 hours, or
// from the built-in fallback table below when that is unset or unreachable.
const SUPPORTED = ["USD", "EUR", "GBP", "BDT", "INR", "AUD", "CAD", "JPY"];
// Approximate USD rates, used only when no live source is configured.
const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79, BDT: 120, INR: 84, AUD: 1.52, CAD: 1.38, JPY: 150 };
const FALLBACK_DATE = "2026-10-01";
const TTL = 12 * 3600 * 1000;

let cache = null;

const currencies = () => {
  const want = String(process.env.CURRENCIES || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const list = want.length ? want.filter((c) => SUPPORTED.includes(c)) : SUPPORTED;
  return list.includes("USD") ? list : ["USD", ...list];
};

async function load(fetchImpl = fetch) {
  const url = process.env.FX_RATES_URL;
  if (url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetchImpl(url, { signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json();
      const rates = {};
      for (const c of currencies()) {
        const v = Number(j?.rates?.[c]);
        if (Number.isFinite(v) && v > 0) rates[c] = v;
      }
      if (rates.USD === 1 && Object.keys(rates).length > 1) {
        return { base: "USD", rates, source: "live", updatedAt: new Date().toISOString() };
      }
    } catch {
      // fall through to the built-in table
    }
  }
  const rates = Object.fromEntries(currencies().map((c) => [c, FALLBACK[c]]));
  return { base: "USD", rates, source: "fallback", updatedAt: FALLBACK_DATE };
}

async function get(fetchImpl) {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const value = await load(fetchImpl);
  // Retry a failed live source sooner than a successful one.
  cache = { value, at: value.source === "live" || !process.env.FX_RATES_URL ? Date.now() : Date.now() - TTL + 600000 };
  return value;
}

const _reset = () => (cache = null);

module.exports = { get, load, SUPPORTED, _reset };
