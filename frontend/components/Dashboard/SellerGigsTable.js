"use client";
// Fiverr-style "Gigs" management section. Status tabs (Active /
// Pending Approval / Requires Modification / Draft / Denied / Paused)
// with counts, then a table of the selected tab's gigs with last-30d
// metrics (impressions, clicks, orders, cancellation rate).
//
// Data comes from /v1/gig/mine/stats — one round-trip covers every tab.
// Clicking a gig opens it in /gig/edit. "Create a new Gig" routes to
// /gig/add.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { baseApi } from "@/app/redux/api/baseApi";

// Seller sends a gig back to review after making the requested changes.
const resubmitApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    resubmitGig: b.mutation({ query: (id) => ({ url: `/gig/${id}`, method: "PATCH", body: { gigStatus: "pending" } }), invalidatesTags: ["MyGigs", "Gigs"] }),
  }),
});
import Link from "next/link";
import Image from "next/image";
import {
  IoAddCircleOutline,
  IoEyeOutline,
  IoStatsChartOutline,
  IoAlertCircleOutline,
  IoCreateOutline,
  IoMegaphoneOutline,
} from "react-icons/io5";

import { useGetMyGigsStatsQuery } from "@/app/redux/features/sellerLevelApi";

const STATUS_TABS = [
  { v: "active", label: "Active" },
  { v: "pending", label: "Pending Approval" },
  { v: "requires-modification", label: "Requires Modification" },
  { v: "draft", label: "Draft" },
  { v: "denied", label: "Denied" },
  { v: "paused", label: "Paused" },
];

export default function SellerGigsTable() {
  const { data, isFetching, refetch } = useGetMyGigsStatsQuery();
  const [resubmit, { isLoading: resubmitting }] = resubmitApi.useResubmitGigMutation();
  const onResubmit = async (g) => {
    const r = await resubmit(g._id || g.id);
    if (r.error) return toast.error(r.error?.data?.message || "Could not resubmit");
    toast.success("Sent for review again");
    refetch();
  };
  const [tab, setTab] = useState("active");

  const counts = data?.counts || {};
  const gigs = data?.gigs || [];
  const visible = useMemo(
    () => gigs.filter((g) => (g.status || "active") === tab),
    [gigs, tab]
  );

  return (
    <section className="mb-6 md:mb-8 bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <header className="px-5 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Gigs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your services — track performance and create new gigs.
          </p>
        </div>
        <Link
          href="/gig/add"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
        >
          <IoAddCircleOutline className="w-4 h-4" />
          Create a new Gig
        </Link>
      </header>

      <nav className="px-3 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={`relative px-3.5 py-3 text-sm font-medium whitespace-nowrap transition ${
              tab === t.v
                ? "text-emerald-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
            <span
              className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                tab === t.v
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {counts[t.v] || 0}
            </span>
            {tab === t.v && (
              <span className="absolute left-3.5 right-3.5 bottom-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="px-5 md:px-6 py-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {STATUS_TABS.find((t) => t.v === tab)?.label} gigs
        </h3>
        <span className="text-xs text-gray-500 inline-flex items-center gap-1">
          <IoStatsChartOutline />
          Last 30 days
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 md:px-6 py-3 font-semibold">Gig</th>
              <th className="text-right px-3 py-3 font-semibold">
                Impressions
              </th>
              <th className="text-right px-3 py-3 font-semibold">Clicks</th>
              <th className="text-right px-3 py-3 font-semibold">Orders</th>
              <th className="text-right px-3 py-3 font-semibold">
                Cancellations
              </th>
              <th className="text-right px-3 py-3 font-semibold" title="Success Score 1–10 (last 90 days)">
                Success
              </th>
              <th className="text-right px-5 md:px-6 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isFetching && gigs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  Loading gigs…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center">
                  <EmptyState tab={tab} />
                </td>
              </tr>
            ) : (
              visible.map((g) => (
                <tr key={g._id} className="hover:bg-gray-50/60">
                  <td className="px-5 md:px-6 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-14 h-10 rounded-md bg-gray-100 overflow-hidden">
                        {g.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[280px]">
                          {g.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {`Starting at $${g.price}`}
                        </div>
                        {g.moderation?.reason &&
                          (g.status === "denied" ||
                            g.status === "requires-modification") && (
                            <div className="mt-1 inline-flex items-start gap-1 text-xs text-rose-700">
                              <IoAlertCircleOutline className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span className="line-clamp-2 max-w-[260px]">
                                {g.moderation.reason}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right text-gray-900 tabular-nums">
                    {Number(g.stats?.impressions || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right text-gray-900 tabular-nums">
                    {Number(g.stats?.clicks || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right text-gray-900 tabular-nums">
                    {Number(g.stats?.orders || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right text-gray-900 tabular-nums">
                    {g.stats?.cancellationRate || 0}%
                    <div className="text-xs text-gray-400">
                      ({Number(g.stats?.cancellations || 0)})
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right text-gray-900 tabular-nums">
                    {g.successScore?.score != null ? `${g.successScore.score}/10` : "—"}
                    <div className="text-xs text-gray-400">
                      {g.successScore?.score != null ? `${g.successScore.orders} orders` : `needs ${g.successScore?.minOrders || 5} orders`}
                    </div>
                  </td>
                  <td className="px-5 md:px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1 sm:gap-3 text-xs">
                      {(g.status === "requires-modification" || g.status === "denied") && (
                        <button type="button" disabled={resubmitting} onClick={() => onResubmit(g)} className="text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-50 min-h-[44px] px-2" title="Send back for review after editing">
                          Resubmit
                        </button>
                      )}
                      {g.status === "active" && (
                        <Link
                          href={`/gig/${g.slug}`}
                          target="_blank"
                          className="text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 min-h-[44px] px-2"
                          title="View live gig"
                        >
                          <IoEyeOutline className="w-3.5 h-3.5" />
                          View
                        </Link>
                      )}
                      {g.status === "active" && (
                        <Link
                          href={`/promotions?gig=${g._id}`}
                          className="text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 min-h-[44px] px-2"
                          title="Promote this gig"
                        >
                          <IoMegaphoneOutline className="w-3.5 h-3.5" />
                          Promote
                        </Link>
                      )}
                      <Link
                        href={`/gig/edit?id=${g._id}`}
                        className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1 min-h-[44px] px-2"
                        title="Edit gig"
                      >
                        <IoCreateOutline className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({ tab }) {
  const copy = {
    active: {
      title: "No active gigs",
      hint: "Create a new gig or activate a paused one to start receiving orders.",
    },
    pending: {
      title: "No gigs pending approval",
      hint: "New gigs that require admin moderation will appear here.",
    },
    "requires-modification": {
      title: "Nothing needs changes",
      hint: "If a reviewer flags a gig, you'll see what needs fixing here.",
    },
    draft: {
      title: "No drafts",
      hint: "Drafts let you save progress before publishing a gig.",
    },
    denied: {
      title: "No denied gigs",
      hint: "Denied gigs can be edited and resubmitted for review.",
    },
    paused: {
      title: "No paused gigs",
      hint: "Pause a gig from its edit page when you're not taking orders.",
    },
  }[tab] || { title: "Nothing here", hint: "" };

  return (
    <div className="flex flex-col items-center text-center">
      <Image
        width={140}
        height={140}
        src="/not-data.svg"
        alt=""
        className="opacity-70"
      />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{copy.title}</h3>
      <p className="text-xs text-gray-500 mt-1 max-w-md">{copy.hint}</p>
    </div>
  );
}
