// Admin dashboard home — Stripe / Linear-style.
//
// Three visual zones:
//   1. Hero stat band — Revenue, Orders, New users, Avg order value.
//      Each tile carries the period total, vs-prev-period delta, and a
//      sparkline computed from the same dataset that powers the
//      revenue chart below. Big, scannable, the most important info.
//   2. Mid section — full-width Revenue area chart + a 3-up donut/bar
//      row for Order status mix, Role split, and New sign-ups by day.
//   3. Bottom — two leaderboards (top-earning sellers + top-ordered
//      gigs) and the Recent users feed.
//
// Every data point comes from existing /admin endpoints — no new
// backend needed.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineCurrencyDollar,
  HiOutlineShoppingBag,
  HiOutlineUserAdd,
  HiOutlineTrendingUp,
} from "react-icons/hi";
import {
  IoArrowUp,
  IoArrowDown,
  IoEllipsisHorizontalOutline,
} from "react-icons/io5";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import {
  useGetAdminGigsQuery,
  useGetAdminOrdersQuery,
  useGetIncomeRatioQuery,
  useGetRecentUserQuery,
  useGetUserRatioQuery,
  useTotalStatusQuery,
} from "../redux/api/apiSlice";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Button from "../common/Button";
import Avatar from "../common/Avatar";
import { formatMoney, formatNumber, timeAgo } from "../utils/format";
import cls from "../utils/cls";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const ORDER_STATUS_COLORS = {
  active: "#10B981",
  late: "#F59E0B",
  delivered: "#0EA5E9",
  cancelled: "#F43F5E",
};

const ROLE_COLORS = ["#10B981", "#0EA5E9", "#F59E0B"];

export default function DashboardHome() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // --- API ---
  const { data: totalStatus, isLoading: loadingTotal } = useTotalStatusQuery();
  const totals = totalStatus?.data?.attributes || {};

  const { data: incomeRatio } = useGetIncomeRatioQuery(year);
  const incomeData = useMemo(() => {
    const raw =
      incomeRatio?.data?.attributes?.results || incomeRatio?.data?.attributes || [];
    if (Array.isArray(raw) && raw[0] && raw[0].month != null) {
      return raw.map((d) => ({
        month:
          typeof d.month === "number"
            ? MONTHS[d.month - 1]?.slice(0, 3)
            : String(d.month).slice(0, 3),
        total: Number(d.total || d.amount || d.income || 0),
      }));
    }
    if (raw && typeof raw === "object") {
      return MONTHS.map((m, i) => ({
        month: m.slice(0, 3),
        total: Number(raw[String(i + 1)] || raw[m] || 0),
      }));
    }
    return MONTHS.map((m) => ({ month: m.slice(0, 3), total: 0 }));
  }, [incomeRatio]);
  const yearTotal = incomeData.reduce((s, d) => s + d.total, 0);

  const { data: userRatio } = useGetUserRatioQuery(month);
  const userData = useMemo(() => {
    const raw =
      userRatio?.data?.attributes?.results || userRatio?.data?.attributes || [];
    if (Array.isArray(raw) && raw[0] && raw[0].day != null) {
      return raw.map((d) => ({
        day: String(d.day),
        total: Number(d.total || d.count || 0),
      }));
    }
    return Array.from({ length: 30 }).map((_, i) => ({
      day: String(i + 1),
      total: 0,
    }));
  }, [userRatio]);
  const monthTotal = userData.reduce((s, d) => s + d.total, 0);

  const { data: recentUser } = useGetRecentUserQuery();
  const recents = recentUser?.data?.attributes?.results?.slice(0, 6) || [];

  const { data: ordersRaw } = useGetAdminOrdersQuery({});
  const orders = ordersRaw?.data?.attributes?.results || [];

  const { data: gigsRaw } = useGetAdminGigsQuery({});
  const gigs = gigsRaw?.data?.attributes?.results || [];

  // --- Derived ---
  const currentMonthIdx = now.getMonth();
  const lastMonthRev = incomeData[currentMonthIdx]?.total || 0;
  const prevMonthRev = incomeData[currentMonthIdx - 1]?.total || 0;
  const revDelta = pctDelta(lastMonthRev, prevMonthRev);

  // 30-day orders count + avg order value from the live orders list.
  const last30d = new Date(Date.now() - 30 * 86400000);
  const recent30dOrders = orders.filter(
    (o) => new Date(o.createdAt || 0) >= last30d && o.status !== "cancelled"
  );
  const orderCount30d = recent30dOrders.length;
  const orderTotal30d = recent30dOrders.reduce(
    (s, o) => s + Number(o.items?.[0]?.price || o.price || 0),
    0
  );
  const aov30d = orderCount30d > 0 ? orderTotal30d / orderCount30d : 0;

  // Order status pie data.
  const statusMix = useMemo(() => {
    const acc = { active: 0, late: 0, delivered: 0, cancelled: 0 };
    for (const o of orders) {
      const s = (o.status || "active").toLowerCase();
      if (acc[s] != null) acc[s] += 1;
    }
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0);
  }, [orders]);

  // Roles pie.
  const rolesMix = useMemo(
    () =>
      [
        { name: "Freelancers", value: Number(totals.totalFreelancer) || 0 },
        { name: "Buyers", value: Number(totals.totalBuyer) || 0 },
      ].filter((d) => d.value > 0),
    [totals]
  );

  // Top sellers leaderboard (from orders).
  const topSellers = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const id = o.freelancerId?._id || o.freelancerId?.id || "";
      if (!id) continue;
      const entry =
        map.get(id) ||
        {
          id,
          name:
            o.freelancerId?.fullName ||
            o.freelancerId?.username ||
            "Seller",
          image: o.freelancerId?.image,
          orders: 0,
          earnings: 0,
        };
      entry.orders += 1;
      entry.earnings += Number(o.items?.[0]?.price || o.price || 0);
      map.set(id, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);
  }, [orders]);

  // Top gigs leaderboard (from orders).
  const topGigs = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const id = o.gigId?._id || o.gigId?.id || "";
      if (!id) continue;
      const entry =
        map.get(id) ||
        {
          id,
          title: o.gigId?.title || o.items?.[0]?.name || "Gig",
          image: o.gigId?.images?.[0],
          orders: 0,
          earnings: 0,
        };
      if (o.status !== "cancelled") {
        entry.orders += 1;
        entry.earnings += Number(o.items?.[0]?.price || o.price || 0);
      }
      map.set(id, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        subtitle="Here's what's happening across the Qwlee marketplace today."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/dashboard/orders")}>
              View orders
            </Button>
            <Button onClick={() => navigate("/dashboard/reports")}>
              Open reports
            </Button>
          </>
        }
      />

      {/* Hero stat band */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroStat
          label="Revenue this month"
          value={formatMoney(lastMonthRev)}
          delta={revDelta}
          deltaSuffix="vs last month"
          icon={HiOutlineCurrencyDollar}
          tone="emerald"
          sparkData={incomeData}
          sparkKey="total"
        />
        <HeroStat
          label="Orders (30d)"
          value={formatNumber(orderCount30d)}
          delta={null}
          icon={HiOutlineShoppingBag}
          tone="sky"
          sparkData={userData}
          sparkKey="total"
        />
        <HeroStat
          label="New sign-ups (this mo.)"
          value={formatNumber(monthTotal)}
          delta={null}
          icon={HiOutlineUserAdd}
          tone="violet"
          sparkData={userData}
          sparkKey="total"
        />
        <HeroStat
          label="Avg order value"
          value={formatMoney(aov30d)}
          delta={null}
          icon={HiOutlineTrendingUp}
          tone="amber"
          sparkData={incomeData}
          sparkKey="total"
          inverted
        />
      </section>

      {/* Revenue full-width */}
      <Card
        title="Revenue"
        subtitle={`${formatMoney(yearTotal)} earned in ${year}`}
        actions={
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-ink-200 bg-white text-sm"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            )}
          </select>
        }
      >
        <div className="h-72 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={incomeData} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip
                cursor={{ stroke: "#cbd5e1", strokeDasharray: 4 }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                }}
                formatter={(v) => [formatMoney(v), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#059669"
                strokeWidth={2.5}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3-up: Order status / Role split / Sign-ups bars */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Order status mix" subtitle="All-time across the platform">
          <DonutChart data={statusMix} colors={ORDER_STATUS_COLORS} />
        </Card>
        <Card title="People" subtitle="Freelancers vs Buyers">
          <DonutChart
            data={rolesMix}
            colors={{ Freelancers: ROLE_COLORS[0], Buyers: ROLE_COLORS[1] }}
          />
        </Card>
        <Card
          title="New sign-ups"
          subtitle={`${formatNumber(monthTotal)} in ${MONTHS[month - 1]}`}
          actions={
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 px-2 rounded-lg border border-ink-200 bg-white text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.slice(0, 3)}
                </option>
              ))}
            </select>
          }
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userData} margin={{ left: 0, right: 4, top: 8 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15,23,42,0.04)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}
                  formatter={(v) => [formatNumber(v), "Sign-ups"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Leaderboards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Top sellers"
          subtitle="By non-cancelled earnings"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/frelancer")}
            >
              View all →
            </Button>
          }
          bodyClassName="p-0"
        >
          <Leaderboard
            items={topSellers}
            empty="No completed orders yet."
            primaryKey="earnings"
            secondaryKey="orders"
            renderAvatar={(s) => (
              <Avatar src={s.image} name={s.name} size={32} rounded />
            )}
            primaryLabel="Earnings"
            secondaryLabel="orders"
          />
        </Card>

        <Card
          title="Top gigs"
          subtitle="By order count"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/gigs")}
            >
              View all →
            </Button>
          }
          bodyClassName="p-0"
        >
          <Leaderboard
            items={topGigs}
            empty="No orders to rank yet."
            primaryKey="orders"
            secondaryKey="earnings"
            renderAvatar={(g) =>
              g.image ? (
                <img
                  src={g.image}
                  alt=""
                  className="w-10 h-7 rounded-md object-cover bg-ink-100"
                />
              ) : (
                <div className="w-10 h-7 rounded-md bg-ink-100" />
              )
            }
            label={(g) => g.title}
            primaryLabel="Orders"
            secondaryLabel="earnings"
            formatSecondary={formatMoney}
          />
        </Card>
      </section>

      {/* Recent users */}
      <Card
        title="Recent users"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/buyerlist")}
          >
            View all →
          </Button>
        }
        bodyClassName="p-0"
      >
        {recents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            No recent users.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {recents.map((u) => (
              <li
                key={u._id || u.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60 transition"
              >
                <Avatar src={u.image} name={u.fullName} size={36} rounded />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {u.fullName || "Member"}
                  </div>
                  <div className="text-xs text-ink-500 truncate">{u.email}</div>
                </div>
                <span className="text-xs font-medium text-ink-700 capitalize whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ink-100">
                  {u.role || "buyer"}
                </span>
                <span className="text-xs text-ink-400 whitespace-nowrap">
                  {timeAgo(u.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// -- Components ------------------------------------------------------------
const TONE_GRADIENT = {
  emerald: { from: "#ECFDF5", to: "#FFFFFF", stroke: "#10B981" },
  sky: { from: "#F0F9FF", to: "#FFFFFF", stroke: "#0EA5E9" },
  violet: { from: "#F5F3FF", to: "#FFFFFF", stroke: "#8B5CF6" },
  amber: { from: "#FFFBEB", to: "#FFFFFF", stroke: "#F59E0B" },
};

function HeroStat({
  label,
  value,
  delta,
  deltaSuffix,
  icon: Icon,
  tone = "emerald",
  sparkData,
  sparkKey,
  inverted,
}) {
  const t = TONE_GRADIENT[tone] || TONE_GRADIENT.emerald;
  const up = delta != null && delta >= 0;
  return (
    <article
      className="relative bg-white border border-ink-200 rounded-2xl p-5 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 65%)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            {label}
          </div>
          <div className="mt-1 text-2xl md:text-3xl font-bold text-ink-900 tabular-nums truncate">
            {value}
          </div>
          {delta != null && (
            <div
              className={cls(
                "mt-1 inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                up
                  ? "bg-primary-50 text-primary-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              {up ? (
                <IoArrowUp className="w-3 h-3" />
              ) : (
                <IoArrowDown className="w-3 h-3" />
              )}
              {Math.abs(delta).toFixed(0)}%
              {deltaSuffix ? (
                <span className="font-normal text-ink-500 ml-1">
                  {deltaSuffix}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: t.stroke + "22", color: t.stroke }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="absolute right-0 bottom-0 left-0 h-14 pointer-events-none opacity-90">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={t.stroke} stopOpacity={0.3} />
                <stop offset="95%" stopColor={t.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={sparkKey}
              stroke={t.stroke}
              strokeWidth={2}
              fill={`url(#spark-${tone})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function DonutChart({ data, colors }) {
  const total = (data || []).reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (total === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-ink-500">
        No data yet.
      </div>
    );
  }
  return (
    <div className="h-56 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={56}
            outerRadius={82}
            paddingAngle={2}
            stroke="none"
            dataKey="value"
            nameKey="name"
          >
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={
                  typeof colors === "function"
                    ? colors(d.name, i)
                    : colors[d.name] || colors[i % colors.length] || ROLE_COLORS[i % ROLE_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
            formatter={(v, n) => [formatNumber(v), n]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-7">
        <div className="text-[10px] uppercase tracking-wider text-ink-400">
          Total
        </div>
        <div className="text-xl font-bold text-ink-900 tabular-nums">
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({
  items,
  empty,
  primaryKey,
  secondaryKey,
  renderAvatar,
  label,
  primaryLabel,
  secondaryLabel,
  formatSecondary,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-ink-500">{empty}</div>
    );
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((it, i) => (
        <li
          key={it.id || i}
          className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60 transition"
        >
          <span className="w-5 text-xs font-bold text-ink-400 tabular-nums">
            {i + 1}
          </span>
          {renderAvatar(it)}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink-900 truncate">
              {label ? label(it) : it.name}
            </div>
            <div className="text-[11px] text-ink-500">
              {formatSecondary
                ? formatSecondary(it[secondaryKey])
                : formatNumber(it[secondaryKey])}{" "}
              {secondaryLabel}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-ink-900 tabular-nums">
              {primaryKey === "earnings"
                ? formatMoney(it[primaryKey])
                : formatNumber(it[primaryKey])}
            </div>
            <div className="text-[10px] text-ink-400 uppercase tracking-wider">
              {primaryLabel}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// -- Helpers ---------------------------------------------------------------
function pctDelta(curr, prev) {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) {
    if (c === 0) return 0;
    return 100;
  }
  return ((c - p) / p) * 100;
}
