"use client";
// /analytics — seller performance: earnings trend, rates and a per-gig
// funnel (impressions → clicks → orders → revenue).
import { useState } from "react";
import Link from "next/link";
import { baseApi } from "@/app/redux/api/baseApi";
import useUser from "@/hooks/useUser";

const api = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getSellerAnalytics: b.query({ query: (days) => `/analytics/seller?days=${days}`, transformResponse: (r) => r?.data?.attributes }),
  }),
});

const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]];
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
function delta(cur, prev) {
  if (!prev) return null;
  const d = Math.round(((cur - prev) / prev) * 100);
  return <span className={d >= 0 ? "text-emerald-700" : "text-rose-600"}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}% vs previous</span>;
}

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs">{sub}</p> : null}
    </div>
  );
}

export default function SellerAnalytics() {
  const user = useUser();
  const [days, setDays] = useState(30);
  const isSeller = user?.role === "freelancer";
  const { data, isFetching, error } = api.useGetSellerAnalyticsQuery(days, { skip: !isSeller });
  if (!user) return <main className="max-w-6xl mx-auto px-4 py-10"><p className="text-gray-600">Sign in to see your analytics.</p></main>;
  if (!isSeller) return <main className="max-w-6xl mx-auto px-4 py-10"><p className="text-gray-600">Analytics are for sellers. <Link className="text-emerald-700 underline" href="/dashboard">Back to dashboard</Link></p></main>;
  const t = data?.totals;
  const max = Math.max(1, ...(data?.series || []).map((s) => s.earnings));
  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <div role="tablist" aria-label="Date range" className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {RANGES.map(([d, label]) => (
            <button key={d} role="tab" aria-selected={days === d} type="button" onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-md ${days === d ? "bg-emerald-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{label}</button>
          ))}
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-600">Could not load analytics.</p> : !t ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className={isFetching ? "opacity-60 transition" : ""}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Earnings" value={money(t.earnings)} sub={delta(t.earnings, t.earningsPrev)} />
            <Kpi label="New orders" value={t.orders} sub={delta(t.orders, t.ordersPrev)} />
            <Kpi label="Avg. order value" value={money(t.avgOrderValue)} />
            <Kpi label="Tips" value={money(t.tips)} />
            <Kpi label="On-time delivery" value={t.onTimeRate == null ? "—" : `${t.onTimeRate}%`} />
            <Kpi label="Cancellation rate" value={`${t.cancellationRate}%`} sub={<span className="text-gray-500">{t.cancelled} cancelled</span>} />
            <Kpi label="Rating" value={t.rating == null ? "—" : `${t.rating} ★`} sub={<span className="text-gray-500">{t.reviews} reviews</span>} />
            <Kpi label="Repeat buyers" value={`${t.repeatBuyerRate}%`} />
          </div>

          <section className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-gray-900">Earnings over time</h2>
            {data.series.length === 0 ? <p className="mt-3 text-sm text-gray-500">No completed orders in this period.</p> : (
              <div className="mt-4 flex items-end gap-1 h-48" role="img" aria-label={`Earnings by period: ${data.series.map((s) => `${s.period} ${money(s.earnings)}`).join(", ")}`}>
                {data.series.map((s) => (
                  <div key={s.period} className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group" title={`${s.period}: ${money(s.earnings)} · ${s.orders} orders`}>
                    <div className="w-full rounded-t bg-emerald-500 group-hover:bg-emerald-600" style={{ height: `${Math.max(2, (s.earnings / max) * 100)}%` }} />
                    {data.series.length <= 14 ? <span className="mt-1 text-xs text-gray-500 truncate w-full text-center">{s.period.slice(5)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
            <h2 className="text-base font-semibold text-gray-900">Gigs</h2>
            <p className="text-xs text-gray-500">Impressions and clicks are all-time; orders and revenue are for the selected range.</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">Gig</th><th className="py-2 px-2 font-medium text-right">Impressions</th><th className="py-2 px-2 font-medium text-right">Clicks</th>
                  <th className="py-2 px-2 font-medium text-right">CTR</th><th className="py-2 px-2 font-medium text-right">Orders</th><th className="py-2 px-2 font-medium text-right">Conversion</th><th className="py-2 pl-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.gigs.map((g) => (
                  <tr key={g.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3 max-w-xs"><Link href={`/gig/${g.slug}`} className="line-clamp-1 text-gray-900 hover:underline">{g.title}</Link>{g.status !== "active" ? <span className="text-xs text-gray-500"> · {g.status}</span> : null}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.impressions.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.clicks.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.ctr}%</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.orders}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.conversion}%</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{money(g.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </main>
  );
}
