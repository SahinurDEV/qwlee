// /dashboard/searches — admin monitor for the marketplace search log.
//
// Three sections:
//   1. KPI tiles (total / last 24h / last 7d / unique queries / anon vs auth)
//   2. Top countries strip (last 7d) for at-a-glance geo view
//   3. Filterable, paginated table of every search row (query, who,
//      country, IP, route, when) so the admin can audit what people are
//      looking for and react with content/SEO changes.

import { useMemo, useState } from "react";
import { IoSearch } from "react-icons/io5";
import {
  TbSearch,
  TbWorld,
  TbUserCheck,
  TbUserOff,
  TbCalendarStats,
  TbChartBar,
} from "react-icons/tb";

import {
  useGetAdminSearchesQuery,
  useGetSearchStatsQuery,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Kpi from "../../common/Kpi";
import Avatar from "../../common/Avatar";
import StatusPill from "../../common/StatusPill";
import { formatDate, formatNumber, timeAgo, truncate } from "../../utils/format";

const SCOPE_TABS = [
  { v: "all", label: "All" },
  { v: "auth", label: "Signed-in" },
  { v: "anon", label: "Anonymous" },
];

const PAGE_SIZE = 50;

export default function SearchLogs() {
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);

  const { data: stats } = useGetSearchStatsQuery();
  const { data, isFetching } = useGetAdminSearchesQuery({
    scope,
    search,
    country,
    page,
    limit: PAGE_SIZE,
  });

  const rows = data?.results || [];
  const total = data?.totalResults || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const countryOptions = useMemo(() => {
    const set = new Set();
    (stats?.byCountry || []).forEach((c) => c.country && set.add(c.country));
    rows.forEach((r) => r.country && set.add(r.country));
    return Array.from(set).sort();
  }, [stats, rows]);

  function applyFilters(next) {
    setPage(1);
    if (typeof next.scope === "string") setScope(next.scope);
    if (typeof next.search === "string") setSearch(next.search);
    if (typeof next.country === "string") setCountry(next.country);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search logs"
        subtitle="Every marketplace search query — see what visitors and members are looking for, by country."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Total searches"
          value={formatNumber(stats?.total)}
          icon={TbSearch}
          tone="emerald"
        />
        <Kpi
          label="Last 24h"
          value={formatNumber(stats?.last24h)}
          icon={TbCalendarStats}
          tone="sky"
        />
        <Kpi
          label="Unique (7d)"
          value={formatNumber(stats?.uniqueQueries7d)}
          icon={TbChartBar}
          tone="violet"
        />
        <Kpi
          label="Signed-in / Anonymous"
          value={`${formatNumber(stats?.auth)} / ${formatNumber(stats?.anon)}`}
          icon={TbUserCheck}
          tone="amber"
        />
      </div>

      {(stats?.byCountry || []).length > 0 && (
        <section className="bg-white border border-ink-200 rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <TbWorld className="w-4 h-4 text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">
              Top countries (last 7 days)
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.byCountry.map((c) => (
              <button
                key={c.country}
                type="button"
                onClick={() =>
                  applyFilters({ country: country === c.country ? "" : c.country })
                }
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  country === c.country
                    ? "bg-primary-50 border-primary-200 text-primary-800"
                    : "bg-ink-50 border-ink-100 text-ink-700 hover:bg-ink-100"
                }`}
              >
                {c.country} · {formatNumber(c.count)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white border border-ink-200 rounded-2xl shadow-card">
        <header className="p-4 md:p-5 border-b border-ink-100 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-200 bg-ink-50 focus-within:bg-white focus-within:border-primary-300 transition">
            <IoSearch className="text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => applyFilters({ search: e.target.value })}
              placeholder="Filter by query text…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          <select
            value={country}
            onChange={(e) => applyFilters({ country: e.target.value })}
            className="border border-ink-200 rounded-lg text-sm px-3 py-2 bg-white focus:border-primary-400 outline-none"
          >
            <option value="">All countries</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
            {SCOPE_TABS.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => applyFilters({ scope: t.v })}
                className={`text-xs font-medium px-3 py-2 transition ${
                  scope === t.v
                    ? "bg-primary-600 text-white"
                    : "bg-white text-ink-600 hover:bg-ink-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Query</th>
                <th className="text-left px-4 py-3 font-semibold">Who</th>
                <th className="text-left px-4 py-3 font-semibold">Country</th>
                <th className="text-left px-4 py-3 font-semibold">IP</th>
                <th className="text-left px-4 py-3 font-semibold">Route</th>
                <th className="text-left px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {isFetching && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-ink-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-ink-500">
                    No searches match your filters yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id || r._id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {truncate(r.displayQuery || r.query, 60)}
                    </td>
                    <td className="px-4 py-3">
                      {r.userId ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            src={r.userId.image}
                            name={r.userId.fullName}
                            size={28}
                            rounded
                          />
                          <div className="min-w-0">
                            <div className="text-ink-900 truncate">
                              {r.userId.fullName || r.userId.username}
                            </div>
                            <div className="text-xs text-ink-500 truncate">
                              {r.userId.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-500 text-xs">
                          <TbUserOff className="w-3.5 h-3.5" />
                          Anonymous
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {r.country ? (
                        <span className="inline-flex items-center gap-1.5">
                          {r.countryCode ? (
                            <span className="text-xs font-semibold bg-ink-100 text-ink-700 rounded px-1.5 py-0.5">
                              {r.countryCode}
                            </span>
                          ) : null}
                          {r.country}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600 font-mono text-xs">
                      {r.ip || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-600 text-xs">
                      {truncate(r.route, 30) || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-600 whitespace-nowrap" title={formatDate(r.createdAt, { withTime: true })}>
                      {timeAgo(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <footer className="px-4 py-3 border-t border-ink-100 flex items-center justify-between text-sm">
            <div className="text-ink-500">
              Page {page} of {pages} · {formatNumber(total)} rows
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-ink-700 disabled:opacity-50 hover:bg-ink-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-ink-700 disabled:opacity-50 hover:bg-ink-50"
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
