// /dashboard/analytics — daily signups, orders, GMV and fees, top
// categories and order status mix.
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Kpi from "../../common/Kpi";
import toast from "react-hot-toast";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatMoney, formatNumber } from "../../utils/format";
import { ErrorNote, Tabs } from "./ui";

const COLORS = ["#059669", "#0ea5e9", "#f59e0b", "#e11d48", "#8b5cf6", "#64748b"];

export default function Analytics() {
  const [days, setDays] = useState("30");
  const { data, error } = useAdminQuery(`/admin/analytics?days=${days}`);
  const t = data?.totals;
  const short = (d) => d.slice(5);
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Marketplace activity over time." actions={<Tabs tabs={[{ v: "7", label: "7 days" }, { v: "30", label: "30 days" }, { v: "90", label: "90 days" }, { v: "365", label: "1 year" }]} value={days} onChange={setDays} />} />
      <ErrorNote error={error} />
      {data ? (
        <div className="space-y-5" data-testid="analytics">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi label="Sign-ups" value={formatNumber(t.signups)} />
            <Kpi label="Orders" value={formatNumber(t.orders)} tone="sky" />
            <Kpi label="GMV" value={formatMoney(t.gmv)} tone="violet" />
            <Kpi label="Platform fees" value={formatMoney(t.fees, { maxFractionDigits: 2 })} tone="amber" />
            <Kpi label="New gigs" value={formatNumber(t.gigs)} tone="slate" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="GMV & fees">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Area type="monotone" dataKey="gmv" name="GMV ($)" stroke="#059669" fill="#05966933" /><Area type="monotone" dataKey="fees" name="Fees ($)" stroke="#8b5cf6" fill="#8b5cf633" /></AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Sign-ups & orders">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="buyers" stackId="s" name="Buyers" fill="#0ea5e9" /><Bar dataKey="sellers" stackId="s" name="Sellers" fill="#059669" /><Bar dataKey="orders" name="Orders" fill="#f59e0b" /></BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Top categories by GMV">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.topCategories} layout="vertical" margin={{ left: 40 }}><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" width={130} fontSize={11} /><Tooltip /><Bar dataKey="gmv" name="GMV ($)" fill="#059669" radius={[0, 6, 6, 0]} /></BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Order status mix">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart><Pie data={Object.entries(data.statusMix).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} label>{Object.keys(data.statusMix).map((k, i) => <Cell key={k} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      ) : null}
      <Growth days={days} />
    </div>
  );
}

// Funnels (signups in the selected window), monthly signup cohorts and
// the weekly KPI email.
function Growth({ days }) {
  const { data: f } = useAdminQuery(`/admin/kpi/funnel?days=${days}`);
  const { data: c } = useAdminQuery("/admin/kpi/cohorts?months=6");
  const { data: w } = useAdminQuery("/admin/kpi/weekly");
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try { const r = await adminFetch("/admin/jobs/kpi-email", { method: "POST" }); toast.success(`Report sent to ${r.recipients} super admin(s)`); }
    catch (e) { toast.error(e.message); } finally { setSending(false); }
  };
  const Funnel = ({ title, steps }) => (
    <Card title={title}>
      <div className="space-y-2" data-testid={`funnel-${title}`}>
        {(steps || []).map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-sm"><span>{s.label}</span><span><b>{formatNumber(s.count)}</b> <span className="text-ink-400">· {s.ofFirst}%</span></span></div>
            <div className="h-2 rounded bg-ink-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${s.ofFirst}%` }} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
  const heat = (v) => `rgba(5,150,105,${Math.min(1, v / 60) * 0.85 + 0.05})`;
  return (
    <div className="space-y-4 mt-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Funnel title="Buyer funnel" steps={f?.buyer} />
        <Funnel title="Seller funnel" steps={f?.seller} />
      </div>
      <Card title="Buyer cohorts" subtitle="Share of each month's new buyers who placed an order in month 0, 1, 2… after signing up">
        <div className="overflow-x-auto">
          <table className="text-xs" data-testid="cohorts">
            <thead><tr><th className="text-left pr-3">Signed up</th><th className="pr-3">Users</th>{(c?.rows || []).map((_, i) => <th key={i} className="px-2">M{i}</th>)}</tr></thead>
            <tbody>{(c?.rows || []).map((r) => (
              <tr key={r.month}><td className="pr-3 py-1">{r.month}</td><td className="pr-3 text-center">{r.size}</td>
                {r.retention.map((v, i) => <td key={i} className="px-2 py-1 text-center" style={{ background: heat(v), color: v > 35 ? "#fff" : "#111" }}>{v}%</td>)}
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Weekly KPI report" subtitle="Emailed to super admins every Monday (UTC). Last 7 days vs the 7 before." actions={<Button size="sm" loading={sending} onClick={send}>Send now</Button>}>
        {w ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm" data-testid="weekly">
            {Object.entries({ signups: "Sign-ups", orders: "Orders", gmv: "GMV", completed: "Completed", fees: "Fees", disputes: "Disputes" }).map(([k, l]) => (
              <div key={k}><div className="text-ink-500 text-xs">{l}</div><div className="font-semibold">{["gmv", "fees"].includes(k) ? formatMoney(w.current[k]) : formatNumber(w.current[k])}</div>
                <div className="text-xs text-ink-400">{w.change[k] === null ? "—" : `${w.change[k] > 0 ? "+" : ""}${w.change[k]}%`}</div></div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
