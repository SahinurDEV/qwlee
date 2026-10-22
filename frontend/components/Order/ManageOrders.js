"use client";
// Manage Orders — Fiverr-style table.
//
// - One screen for buyer + seller via useViewMode.
// - Tabs: All / Active / Late / Delivered / Cancelled, with live counts
//   from the new /orders/counts endpoint.
// - Search box (counterparty name or gig title, client-side).
// - Sort dropdown (newest, oldest, due soonest, highest total).
// - Each row: counterparty avatar + name, gig thumb + title, due/started,
//   total, status pill, View action.

import { useMemo, useState } from "react";
import Link from "next/link";
import moment from "moment";
import { Pagination, Select } from "antd";
import { IoSearch, IoEllipsisHorizontal } from "react-icons/io5";

import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import { useGetBuyerAllOrderQuery } from "@/app/redux/features/order/buyerOrderApi";
import {
  useGetFreelancerAllOrderQuery,
  useGetOrderCountsQuery,
} from "@/app/redux/features/order/freelancerOrderApi";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import Avatar from "@/components/common/Avatar";

const PAGE_SIZE = 10;

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "late", label: "Late" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE = {
  active: { label: "In progress", chip: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  late: { label: "Late", chip: "bg-rose-50 text-rose-700 border-rose-100", dot: "bg-rose-500" },
  delivered: { label: "Delivered", chip: "bg-sky-50 text-sky-700 border-sky-100", dot: "bg-sky-500" },
  completed: { label: "Completed", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-600" },
  cancelled: { label: "Cancelled", chip: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" },
};

export default function ManageOrders() {
  const user = useUser();
  const { isSelling, ready } = useViewMode(user);
  const mode = isSelling ? "seller" : "buyer";

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const queryArg = useMemo(() => ({ limit: 200 }), []);
  const buyerQuery = useGetBuyerAllOrderQuery(queryArg, { skip: !ready || isSelling });
  const sellerQuery = useGetFreelancerAllOrderQuery(queryArg, { skip: !ready || !isSelling });
  const { data, isLoading, isError } = isSelling ? sellerQuery : buyerQuery;

  const { data: counts } = useGetOrderCountsQuery(mode, { skip: !ready });

  const rows = data?.results || [];

  // Client-side filter+sort+search. The dataset per user is small; the
  // table feels instant this way without paying a roundtrip on every
  // keystroke.
  const visible = useMemo(() => {
    let list = rows;
    if (activeTab !== "all") list = list.filter((o) => o.status === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) => {
        const counterparty = isSelling
          ? `${o.clientId?.fullName || ""} ${o.clientId?.username || ""}`
          : `${o.freelancerId?.fullName || ""} ${o.freelancerId?.username || ""}`;
        return (
          (o.gigId?.title || "").toLowerCase().includes(q) ||
          counterparty.toLowerCase().includes(q) ||
          String(o._id || "").toLowerCase().includes(q)
        );
      });
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "dueSoon":
          return new Date(a.deliveryDate) - new Date(b.deliveryDate);
        case "highest":
          return (b.items?.[0]?.price || b.price || 0) - (a.items?.[0]?.price || a.price || 0);
        case "newest":
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    return list;
  }, [rows, activeTab, search, sortBy, isSelling]);

  const total = visible.length;
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function tabCount(key) {
    if (!counts) return null;
    return counts[key];
  }

  return (
    <main className="container mx-auto px-4 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Manage orders
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isSelling
            ? "Orders coming in for the gigs you sell."
            : "Orders you placed across the Qwlee marketplace."}
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex flex-wrap gap-1 -mb-px">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            const c = tabCount(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key);
                  setPage(1);
                }}
                className={`px-3 md:px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  active
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
                {c != null && (
                  <span
                    className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                      active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 max-w-sm w-full focus-within:border-emerald-500">
          <IoSearch className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={isSelling ? "Search by buyer or gig…" : "Search by seller or gig…"}
            aria-label="Search orders"
            className="flex-1 px-2 py-2 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Sort by</label>
          <Select
            aria-label="Sort orders"
            value={sortBy}
            onChange={setSortBy}
            size="middle"
            style={{ minWidth: 160 }}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "dueSoon", label: "Due soonest" },
              { value: "highest", label: "Highest total" },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <section className="mt-5 bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <SkeletonRows />
        ) : isError ? (
          <Banner tone="error">We couldn&rsquo;t load your orders. Try refreshing.</Banner>
        ) : pageRows.length === 0 ? (
          <EmptyState activeTab={activeTab} isSelling={isSelling} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-400 bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">{isSelling ? "Buyer" : "Seller"}</th>
                  <th className="px-4 py-3 font-semibold">Gig</th>
                  <th className="px-4 py-3 font-semibold">{activeTab === "delivered" || activeTab === "cancelled" ? "Closed" : "Due in"}</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((o) => (
                  <Row key={o._id} order={o} isSelling={isSelling} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {total > PAGE_SIZE && (
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 200, behavior: "smooth" });
          }}
          showSizeChanger={false}
          className="flex justify-center mt-6"
        />
      )}
    </main>
  );
}

function Row({ order, isSelling }) {
  const counterparty = isSelling ? order.clientId : order.freelancerId;
  const gig = order.gigId || {};
  const status = STATUS_STYLE[order.status] || STATUS_STYLE.active;
  const total = Number(order.items?.[0]?.price || order.price || 0);
  const dueLabel = (() => {
    if (!order.deliveryDate) return "—";
    if (order.status === "delivered" || order.status === "cancelled") {
      return moment(order.updatedAt || order.deliveryDate).format("D MMM YYYY");
    }
    const diff = moment(order.deliveryDate).diff(moment(), "days");
    if (diff < 0) return `${Math.abs(diff)}d late`;
    if (diff === 0) return "today";
    return `${diff} day${diff === 1 ? "" : "s"}`;
  })();
  const dueTone = (() => {
    if (order.status === "late") return "text-rose-600 font-medium";
    if (order.status === "delivered" || order.status === "cancelled") return "text-gray-500";
    const d = moment(order.deliveryDate).diff(moment(), "days");
    if (d <= 1) return "text-amber-600 font-medium";
    return "text-gray-700";
  })();

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40 transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-[140px]">
          <Avatar src={counterparty?.image} name={counterparty?.fullName} size={32} rounded />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
              {counterparty?.fullName || "—"}
            </div>
            <div className="text-xs text-gray-500 truncate max-w-[160px]">
              {counterparty?.username ? `@${counterparty.username}` : ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/order/${order._id}`}
          className="flex items-center gap-3 group max-w-md"
        >
          <div className="relative w-14 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0">
            <ImageWithFallback
              src={gig?.images?.[0]}
              name={gig?.title}
              fill
              sizes="56px"
              className="object-cover"
              alt={gig?.title || "gig"}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-gray-900 truncate group-hover:text-emerald-700">
              {gig?.title || order?.data?.title || "Gig"}
            </div>
            <div className="text-xs text-gray-400">
              #{String(order._id).slice(-8).toUpperCase()}
            </div>
          </div>
        </Link>
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${dueTone}`}>
        {dueLabel}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
        ${total.toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.chip}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/order/${order._id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-200 hover:bg-white"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
          <div className="ml-6 flex items-center gap-3 flex-1">
            <div className="w-14 h-10 bg-gray-100 rounded-md" />
            <div className="h-3 w-48 bg-gray-100 rounded" />
          </div>
          <div className="h-3 w-14 bg-gray-100 rounded" />
          <div className="h-3 w-14 bg-gray-100 rounded" />
          <div className="h-5 w-20 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ activeTab, isSelling }) {
  const what = activeTab === "all" ? "orders" : `${activeTab} orders`;
  return (
    <div className="px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-gray-900">
        No {what} yet
      </h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        {isSelling
          ? "Once buyers place orders on your gigs, they'll appear here."
          : "Browse the marketplace and place an order to get started."}
      </p>
      <Link
        href={isSelling ? "/gig/add" : "/gig"}
        className="inline-block mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
      >
        {isSelling ? "Create a gig" : "Browse gigs"}
      </Link>
    </div>
  );
}

function Banner({ tone = "info", children }) {
  const cls =
    tone === "error"
      ? "bg-rose-50/40 text-rose-700 border-rose-100"
      : "bg-gray-50 text-gray-700 border-gray-200";
  return <div className={`p-6 text-sm text-center border ${cls}`}>{children}</div>;
}
