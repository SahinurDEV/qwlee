// Success Score (Fiverr-style, 1–10), pure scoring part.
//
// Input: the seller's (or one gig's) orders closed in the last
// `windowDays` (admin setting, default 90). Each signal is a 0–1 value:
//
//   privateRating  average private rating the buyer gave (1–5 → 0–1)
//   rating         average public review rating (1–5 → 0–1)
//   completion     completed / (completed + cancelled)
//   onTime         completed orders whose last delivery was by the due date
//   noDisputes     1 − (orders with a dispute / closed orders)
//
// score = 1 + 9 × (Σ weight × signal / Σ weight), rounded to a whole number.
// A signal with no data (e.g. no private ratings yet) is left out and the
// other weights are rescaled. Weights are admin settings. Fewer than
// `minOrders` closed orders = no score yet (null).
const SIGNALS = ["privateRating", "rating", "completion", "onTime", "noDisputes"];
const DEFAULT_WEIGHTS = { privateRating: 30, rating: 20, completion: 20, onTime: 20, noDisputes: 10 };

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r01 = (r) => (Math.min(5, Math.max(1, r)) - 1) / 4;

/**
 * orders: [{ status: "delivered"|"cancelled", privateRating?, rating?,
 *            onTime?: bool, disputed?: bool }]
 */
function score(orders, { weights = DEFAULT_WEIGHTS, minOrders = 5 } = {}) {
  const done = orders.filter((o) => o.status === "delivered");
  const closed = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");
  const pr = done.map((o) => Number(o.privateRating)).filter((x) => x >= 1);
  const rr = done.map((o) => Number(o.rating)).filter((x) => x >= 1);
  const timed = done.filter((o) => typeof o.onTime === "boolean");
  const signals = {
    privateRating: pr.length ? r01(avg(pr)) : null,
    rating: rr.length ? r01(avg(rr)) : null,
    completion: closed.length ? done.length / closed.length : null,
    onTime: timed.length ? timed.filter((o) => o.onTime).length / timed.length : null,
    noDisputes: closed.length ? 1 - closed.filter((o) => o.disputed).length / closed.length : null,
  };
  let wsum = 0;
  let acc = 0;
  for (const k of SIGNALS) {
    const w = Math.max(0, Number(weights?.[k]) || 0);
    if (signals[k] === null || !w) continue;
    wsum += w;
    acc += w * signals[k];
  }
  const enough = closed.length >= minOrders && wsum > 0;
  return {
    score: enough ? Math.round(1 + 9 * (acc / wsum)) : null,
    orders: closed.length,
    minOrders,
    signals: Object.fromEntries(SIGNALS.map((k) => [k, signals[k] === null ? null : Math.round(signals[k] * 100)])),
  };
}

module.exports = { score, SIGNALS, DEFAULT_WEIGHTS };
