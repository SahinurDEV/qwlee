// Job monitor: every housekeeping step is run through track(), which times
// it, records the outcome in JobRun and keeps one failing step from
// stopping the others.
const JobRun = require("../models/jobRun.model");
const logger = require("../config/logger");

const JOBS = ["autoComplete", "markLate", "autoCancel", "sellerPlans", "hourlyBilling", "subscriptions", "announcements", "bansLifted", "kpiEmail"];
const intervalMs = () => Number(process.env.ORDER_HOUSEKEEPING_MS) || 10 * 60 * 1000;

async function track(job, fn, trigger = "timer") {
  const startedAt = new Date();
  try {
    const result = await fn();
    await JobRun.create({ job, startedAt, ms: Date.now() - startedAt, ok: true, result: summarise(result), trigger }).catch(() => {});
    return result;
  } catch (e) {
    logger.warn(`job ${job} failed: ${e.message}`);
    await JobRun.create({ job, startedAt, ms: Date.now() - startedAt, ok: false, error: String(e.message || e).slice(0, 500), trigger }).catch(() => {});
    return { error: e.message };
  }
}
// Keep stored results small.
const summarise = (r) => {
  try {
    const s = JSON.stringify(r ?? null);
    return s.length > 1000 ? { truncated: s.slice(0, 1000) } : r ?? null;
  } catch { return null; }
};

async function status() {
  const since = new Date(Date.now() - 864e5);
  const stats = await JobRun.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $group: { _id: "$job", runs: { $sum: 1 }, failures: { $sum: { $cond: ["$ok", 0, 1] } }, avgMs: { $avg: "$ms" } } },
  ]);
  const by = Object.fromEntries(stats.map((s) => [s._id, s]));
  const stale = intervalMs() * 3;
  const jobs = await Promise.all(JOBS.map(async (job) => {
    const [last, lastFail] = await Promise.all([
      JobRun.findOne({ job }).sort({ startedAt: -1 }).lean(),
      JobRun.findOne({ job, ok: false }).sort({ startedAt: -1 }).lean(),
    ]);
    const s = by[job] || { runs: 0, failures: 0, avgMs: 0 };
    const health = !last ? "never" : !last.ok ? "failing" : Date.now() - last.startedAt > stale ? "stale" : "ok";
    return { job, health, lastRun: last, lastFailure: lastFail, runs24h: s.runs, failures24h: s.failures, avgMs: Math.round(s.avgMs || 0) };
  }));
  return { intervalMs: intervalMs(), jobs };
}

const history = (job, limit = 50) => JobRun.find(job ? { job } : {}).sort({ startedAt: -1 }).limit(Math.min(200, Number(limit) || 50)).lean();

module.exports = { track, status, history, JOBS };
