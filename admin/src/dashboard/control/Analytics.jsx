// /dashboard/analytics — daily signups, orders, GMV and fees, top
// categories and order status mix.
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Kpi from "../../common/Kpi";
import { useAdminQuery } from "../../utils/adminApi";
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
    </div>
  );
}
