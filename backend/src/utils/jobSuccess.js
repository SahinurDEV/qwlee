// Job Success Score (Upwork-style), pure scoring part.
//
// Each closed order is an outcome:
//   positive  delivered (buyer accepted) with no review or a rating >= 4
//   neutral   delivered with a rating >= 3 and < 4 (doesn't count)
//   negative  delivered with a rating < 3, cancelled after it started,
//             or a dispute that ended in a refund
// score = positive / (positive + negative), as a whole percent.
// Windows: the 6-month window is used when it has at least MIN outcomes,
// otherwise 12 months, otherwise 24. Fewer than MIN everywhere = no score.
const MIN = 5;
const WINDOWS = [6, 12, 24];

function classify(o) {
  if (o.status === "delivered") {
    const r = Number(o.rating);
    if (!Number.isFinite(r) || r <= 0 || r >= 4) return "positive";
    if (r >= 3) return "neutral";
    return "negative";
  }
  if (o.status === "cancelled" || o.refunded) return "negative";
  return null; // still open
}

function score(orders, now = Date.now()) {
  const out = { score: null, windowMonths: null, positive: 0, negative: 0, neutral: 0, total: 0, minOrders: MIN };
  for (const months of WINDOWS) {
    const since = now - months * 30.44 * 864e5;
    const c = { positive: 0, negative: 0, neutral: 0 };
    for (const o of orders) {
      const at = Date.parse(o.closedAt || 0);
      if (!at || at < since) continue;
      const k = classify(o);
      if (k) c[k]++;
    }
    const counted = c.positive + c.negative;
    if (counted >= MIN || months === WINDOWS[WINDOWS.length - 1]) {
      Object.assign(out, c, { total: counted + c.neutral, windowMonths: months });
      if (counted >= MIN) out.score = Math.round((100 * c.positive) / counted);
      if (counted >= MIN) return out;
    }
  }
  return out;
}

// Badge shown next to the score.
const badge = (s) => (s === null ? null : s >= 90 ? "Top performer" : s >= 75 ? "Rising" : null);

module.exports = { score, classify, badge, MIN, WINDOWS };
