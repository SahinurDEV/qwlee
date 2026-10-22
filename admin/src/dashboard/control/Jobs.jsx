// /dashboard/jobs — background housekeeping steps: health, last run,
// failures in the last 24h, recent history; super admins can run now.
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate, timeAgo } from "../../utils/format";
import { ErrorNote } from "./ui";

const LABELS = {
  autoComplete: "Auto-complete ignored deliveries",
  markLate: "Mark late orders",
  autoCancel: "Auto-accept expired cancellations",
  subscriptions: "Bill due subscriptions",
  announcements: "Send scheduled announcements",
  bansLifted: "Lift expired bans",
  kpiEmail: "Weekly KPI email",
};
const TONE = { ok: "bg-emerald-50 text-emerald-700", failing: "bg-rose-50 text-rose-700", stale: "bg-amber-50 text-amber-700", never: "bg-ink-100 text-ink-600" };

export default function Jobs() {
  const { data, error, reload } = useAdminQuery("/admin/jobs/status");
  const [job, setJob] = useState("");
  const { data: hist, reload: reloadHist } = useAdminQuery(`/admin/jobs/history?limit=30${job ? `&job=${job}` : ""}`);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try { await adminFetch("/admin/jobs/housekeeping", { method: "POST" }); toast.success("Housekeeping ran"); reload(); reloadHist(); }
    catch (e) { toast.error(e.message); } finally { setRunning(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Background jobs" subtitle={data ? `Housekeeping runs every ${Math.round(data.intervalMs / 60000)} min. "Stale" means no run for 3 intervals.` : ""} actions={<Button loading={running} onClick={run}>Run housekeeping now</Button>} />
      <ErrorNote error={error} />
      <Card title="Jobs">
        <table className="w-full text-sm" data-testid="jobs">
          <thead><tr className="text-left text-ink-500 text-xs"><th className="py-2">Job</th><th>Health</th><th>Last run</th><th>Runs / failures (24h)</th><th>Avg</th><th>Last error</th></tr></thead>
          <tbody>
            {(data?.jobs || []).map((j) => (
              <tr key={j.job} className="border-t border-ink-100 cursor-pointer hover:bg-ink-50" onClick={() => setJob(j.job === job ? "" : j.job)}>
                <td className="py-2">{LABELS[j.job] || j.job}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs ${TONE[j.health]}`}>{j.health}</span></td>
                <td title={j.lastRun ? formatDate(j.lastRun.startedAt, { withTime: true }) : ""}>{j.lastRun ? timeAgo(j.lastRun.startedAt) : "—"}</td>
                <td>{j.runs24h} / <span className={j.failures24h ? "text-rose-700 font-medium" : ""}>{j.failures24h}</span></td>
                <td>{j.avgMs} ms</td>
                <td className="text-xs text-rose-700 max-w-xs truncate" title={j.lastFailure?.error || ""}>{j.lastFailure ? `${timeAgo(j.lastFailure.startedAt)}: ${j.lastFailure.error}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title={job ? `History: ${LABELS[job] || job}` : "Recent runs"} subtitle="Click a job above to filter.">
        <table className="w-full text-xs" data-testid="history">
          <tbody>
            {(hist?.results || []).map((r) => (
              <tr key={r._id} className="border-t border-ink-100">
                <td className="py-1.5">{formatDate(r.startedAt, { withTime: true })}</td>
                <td>{LABELS[r.job] || r.job}</td>
                <td>{r.ok ? <span className="text-emerald-700">ok</span> : <span className="text-rose-700">failed</span>}</td>
                <td>{r.ms} ms</td><td>{r.trigger}</td>
                <td className="font-mono text-ink-500 truncate max-w-md">{r.ok ? JSON.stringify(r.result) : r.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
