// Funnels, signup cohorts and the weekly KPI email for admins.
// Orders are Payment documents; "delivered" means completed.
const User = require("../models/user.model");
const Gig = require("../models/gig.model");
const Payment = require("../models/payment.model");
const Dispute = require("../models/dispute.model");
const KpiReport = require("../models/kpiReport.model");

const DAY = 864e5;
const clampInt = (v, d, lo, hi) => Math.min(hi, Math.max(lo, Number.parseInt(v, 10) || d));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// Signups in the window and how far they got.
async function funnel({ days } = {}) {
  const d = clampInt(days, 30, 1, 365);
  const since = new Date(Date.now() - d * DAY);
  const buyers = await User.find({ role: "buyer", createdAt: { $gte: since } }, "_id").lean();
  const sellers = await User.find({ role: "freelancer", createdAt: { $gte: since } }, "_id").lean();
  const bIds = buyers.map((u) => u._id);
  const sIds = sellers.map((u) => u._id);
  const [ordered, completedB, withGig, sold] = await Promise.all([
    Payment.distinct("clientId", { clientId: { $in: bIds }, isDeleted: { $ne: true } }),
    Payment.distinct("clientId", { clientId: { $in: bIds }, status: "delivered" }),
    Gig.distinct("userId", { userId: { $in: sIds }, gigStatus: "active" }),
    Payment.distinct("freelancerId", { freelancerId: { $in: sIds }, status: "delivered" }),
  ]);
  const steps = (rows) => rows.map(([label, n], i) => ({ label, count: n, ofFirst: pct(n, rows[0][1]), ofPrevious: i ? pct(n, rows[i - 1][1]) : 100 }));
  return {
    days: d,
    buyer: steps([["Signed up", bIds.length], ["Placed an order", ordered.length], ["Completed an order", completedB.length]]),
    seller: steps([["Signed up", sIds.length], ["Has an active gig", withGig.length], ["Completed a sale", sold.length]]),
  };
}

// For each signup month: share of those users who placed an order in
// month 0, 1, 2… after signing up (as buyers).
async function cohorts({ months } = {}) {
  const m = clampInt(months, 6, 1, 12);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (m - 1), 1));
  const users = await User.find({ role: "buyer", createdAt: { $gte: start } }, "_id createdAt").lean();
  const key = (d) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const signup = new Map(users.map((u) => [String(u._id), key(u.createdAt)]));
  const orders = await Payment.find({ clientId: { $in: users.map((u) => u._id) }, isDeleted: { $ne: true } }, "clientId createdAt").lean();
  const active = new Map(); // `${cohort}:${offset}` -> Set(user)
  for (const o of orders) {
    const c = signup.get(String(o.clientId));
    const off = key(o.createdAt) - c;
    if (off < 0) continue;
    const k = `${c}:${off}`;
    if (!active.has(k)) active.set(k, new Set());
    active.get(k).add(String(o.clientId));
  }
  const nowKey = key(now);
  const rows = [];
  for (let c = key(start); c <= nowKey; c++) {
    const size = users.filter((u) => key(u.createdAt) === c).length;
    const cells = [];
    for (let off = 0; c + off <= nowKey; off++) cells.push(pct(active.get(`${c}:${off}`)?.size || 0, size));
    rows.push({ month: `${Math.floor(c / 12)}-${String((c % 12) + 1).padStart(2, "0")}`, size, retention: cells });
  }
  return { months: m, rows };
}

async function windowStats(from, to) {
  const range = { $gte: from, $lt: to };
  const [users, orders, completed, disputes] = await Promise.all([
    User.countDocuments({ role: { $in: ["buyer", "freelancer"] }, createdAt: range }),
    Payment.find({ createdAt: range, isDeleted: { $ne: true } }, "price").lean(),
    Payment.find({ completedAt: range, status: "delivered" }, "platformFee").lean(),
    Dispute.countDocuments({ createdAt: range }),
  ]);
  const sum = (a, f) => Math.round(a.reduce((s, x) => s + (Number(x[f]) || 0), 0) * 100) / 100;
  return { signups: users, orders: orders.length, gmv: sum(orders, "price"), completed: completed.length, fees: sum(completed, "platformFee"), disputes };
}

// Last 7 days vs the 7 before.
async function weeklySummary(now = new Date()) {
  const end = now;
  const mid = new Date(end - 7 * DAY);
  const start = new Date(end - 14 * DAY);
  const [cur, prev] = await Promise.all([windowStats(mid, end), windowStats(start, mid)]);
  const change = Object.fromEntries(Object.keys(cur).map((k) => [k, prev[k] ? Math.round(((cur[k] - prev[k]) / prev[k]) * 1000) / 10 : null]));
  return { from: mid, to: end, current: cur, previous: prev, change };
}

const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7)).padStart(2, "0")}`;
};

const LABELS = { signups: "New sign-ups", orders: "Orders placed", gmv: "Order value (GMV)", completed: "Orders completed", fees: "Platform fees", disputes: "Disputes opened" };
function html(s) {
  const fmt = (k, v) => (["gmv", "fees"].includes(k) ? `$${v.toFixed(2)}` : String(v));
  const rows = Object.keys(LABELS).map((k) => {
    const c = s.change[k];
    const ch = c === null ? "—" : `${c > 0 ? "+" : ""}${c}%`;
    return `<tr><td style="padding:4px 12px 4px 0">${LABELS[k]}</td><td style="padding:4px 12px;text-align:right"><b>${fmt(k, s.current[k])}</b></td><td style="padding:4px 0;text-align:right;color:#6b7280">${fmt(k, s.previous[k])} · ${ch}</td></tr>`;
  }).join("");
  return `<p>Here are the marketplace numbers for the last 7 days (vs the 7 days before).</p><table style="border-collapse:collapse;font-size:14px">${rows}</table>`;
}

// Sends the email to super admins once per ISO week. force=true (manual
// run) sends again even if this week already went out.
async function sendWeekly({ now = new Date(), force = false } = {}) {
  const week = isoWeek(now);
  if (!force && (await KpiReport.exists({ week }))) return { sent: false, week, reason: "already sent" };
  const summary = await weeklySummary(now);
  const admins = await User.find({ role: "admin", isBan: { $ne: true }, $or: [{ adminRole: { $exists: false } }, { adminRole: null }, { adminRole: "" }, { adminRole: "super" }] }, "email").lean();
  if (!force) {
    try { await KpiReport.create({ week, summary, recipients: admins.length, sentAt: now }); }
    catch (e) { if (e.code === 11000) return { sent: false, week, reason: "already sent" }; throw e; }
  }
  const email = require("./email.service");
  await Promise.all(admins.filter((a) => a.email).map((a) => email.sendEmail(a.email, `Weekly marketplace report (${week})`, html(summary)).catch(() => {})));
  return { sent: true, week, recipients: admins.length, summary };
}

// Housekeeping hook: send on Mondays (UTC).
const maybeSendWeekly = (now = new Date()) => (now.getUTCDay() === 1 ? sendWeekly({ now }) : Promise.resolve({ sent: false, reason: "not Monday" }));

module.exports = { funnel, cohorts, weeklySummary, sendWeekly, maybeSendWeekly, isoWeek };
