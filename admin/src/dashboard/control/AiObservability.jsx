// /dashboard/ai-observability — AI call latency / source without prompts or PII.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Kpi from "../../common/Kpi";
import { useAdminQuery, qs } from "../../utils/adminApi";
import { formatNumber } from "../../utils/format";
import { timeAgo } from "../../utils/format";
import { Empty, ErrorNote, Pager, Tabs, Td, Th } from "./ui";

const FEATS = ["", "dispute", "support", "search", "fraud", "insights"];

export default function AiObservability() {
  const [feature, setFeature] = useState("");
  const [page, setPage] = useState(1);
  const { data: sum, error: sumErr } = useAdminQuery("/admin/ai-call-logs/summary?hours=24");
  const { data, error, loading } = useAdminQuery(`/admin/ai-call-logs${qs({ feature, page, limit: 50 })}`);
  return (
    <div>
      <PageHeader title="AI observability" subtitle="Sidecar call counts and latency for the last 24 hours. No prompts or PII are stored." />
      <ErrorNote error={sumErr || error} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="Calls (24h)" value={formatNumber(sum?.total || 0)} />
        <Kpi label="Groups" value={formatNumber(sum?.rows?.length || 0)} tone="violet" />
        <Kpi label="Errors" value={formatNumber((sum?.rows || []).reduce((n, r) => n + (r.errors || 0), 0))} tone="amber" />
        <Kpi label="Features" value={formatNumber(new Set((sum?.rows || []).map((r) => r._id?.feature)).size)} tone="sky" />
      </div>
      {sum?.rows?.length ? (
        <Card title="By feature · source" className="mb-5" bodyClassName="p-0">
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>Feature</Th><Th>Source</Th><Th>Count</Th><Th>Avg latency</Th><Th>Errors</Th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {sum.rows.map((r, i) => (
                <tr key={i}>
                  <Td className="capitalize">{r._id?.feature}</Td>
                  <Td>{r._id?.source || "—"}</Td>
                  <Td>{r.count}</Td>
                  <Td>{Math.round(r.avgLatencyMs || 0)} ms</Td>
                  <Td>{r.errors || 0}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      ) : null}
      <Card bodyClassName="p-0">
        <div className="p-4 border-b border-ink-100 flex flex-wrap gap-3 items-center">
          <Tabs value={feature || "all"} onChange={(v) => { setFeature(v === "all" ? "" : v); setPage(1); }} tabs={[{ v: "all", label: "All" }, ...FEATS.filter(Boolean).map((f) => ({ v: f, label: f }))]} />
        </div>
        {data?.results?.length ? (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>When</Th><Th>Feature</Th><Th>Source</Th><Th>Model</Th><Th>Latency</Th><Th>OK</Th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((r) => (
                <tr key={r.id}>
                  <Td className="text-xs text-ink-500">{timeAgo(r.createdAt)}</Td>
                  <Td className="capitalize">{r.feature}</Td>
                  <Td>{r.source || "—"}</Td>
                  <Td className="text-xs font-mono">{r.model || "—"}</Td>
                  <Td>{r.latencyMs} ms</Td>
                  <Td>{r.ok ? "yes" : <span className="text-rose-700">no{r.error ? ` — ${r.error}` : ""}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : !loading ? <Empty>No AI calls logged yet.</Empty> : null}
        <div className="px-4 pb-4"><Pager data={data} page={page} setPage={setPage} /></div>
      </Card>
    </div>
  );
}
