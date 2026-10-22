"use client";
// Full notifications page — the navbar dropdown's "See all" link
// points here. Same data source as the dropdown (RTK Query dedupes the
// /v1/notification request), but with filters, an empty state, and a
// pinned "Mark all as read" affordance up top.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IoNotificationsOutline,
  IoCheckmarkDoneOutline,
  IoSettingsOutline,
  IoFilterOutline,
} from "react-icons/io5";
import { MdShoppingCartCheckout, MdMessage } from "react-icons/md";
import { GoVerified } from "react-icons/go";

import {
  useGetNotificationQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from "@/app/redux/features/getNotificationApi";

const TABS = [
  { v: "all", label: "All" },
  { v: "unread", label: "Unread" },
  { v: "order", label: "Orders" },
  { v: "payment", label: "Payments" },
  { v: "message", label: "Messages" },
];

function timeAgo(date) {
  if (!date) return "";
  const d = new Date(date);
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function iconFor(type) {
  switch (type) {
    case "order":
      return MdShoppingCartCheckout;
    case "payment":
      return GoVerified;
    case "message":
      return MdMessage;
    default:
      return IoNotificationsOutline;
  }
}

function hrefFor(n) {
  if (!n) return "/order";
  switch (n.type) {
    case "order":
    case "payment":
      return "/order";
    case "message":
      return "/inbox";
    default:
      return "/order";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const { data, isFetching } = useGetNotificationQuery();
  const items = data?.results || [];
  const unread = data?.unReadCount || 0;

  const [markRead] = useMarkNotificationAsReadMutation();
  const [markAllRead, { isLoading: markingAll }] =
    useMarkAllNotificationsAsReadMutation();

  const counts = useMemo(() => {
    const out = { all: items.length, unread, order: 0, payment: 0, message: 0 };
    for (const n of items) {
      if (out[n.type] != null) out[n.type] += 1;
    }
    return out;
  }, [items, unread]);

  const visible = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "unread") return items.filter((n) => !n.viewStatus);
    return items.filter((n) => n.type === tab);
  }, [items, tab]);

  async function handleClick(n) {
    if (!n.viewStatus) {
      try {
        await markRead(n._id).unwrap();
      } catch {
        /* network blip — UI moves on */
      }
    }
    router.push(hrefFor(n));
  }

  return (
    <main className="bg-gray-50/40 min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-10 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Notifications
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {unread > 0
                ? `${unread} unread · `
                : ""}
              {items.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
          <Link href="/notifications/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            <IoSettingsOutline className="w-4 h-4" aria-hidden />
            Settings
          </Link>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead().catch(() => {})}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-2 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 disabled:opacity-60"
            >
              <IoCheckmarkDoneOutline className="w-4 h-4" />
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
          )}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <IoFilterOutline className="text-gray-400" />
          {TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5 ${
                tab === t.v
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {t.label}
              <span
                className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                  tab === t.v
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[t.v] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {isFetching && items.length === 0 ? (
            <div className="px-6 py-12 text-sm text-gray-500 text-center">
              Loading notifications…
            </div>
          ) : visible.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="divide-y divide-gray-100">
              {visible.map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full text-left flex items-start gap-4 px-5 py-4 border-l-2 transition ${
                        n.viewStatus
                          ? "border-transparent hover:bg-gray-50"
                          : "border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          n.type === "payment"
                            ? "bg-emerald-100 text-emerald-700"
                            : n.type === "message"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm leading-snug ${
                            n.viewStatus ? "text-gray-700" : "text-gray-900 font-semibold"
                          }`}
                        >
                          {n.message || "New activity"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 inline-flex items-center gap-2">
                          <span className="capitalize">{n.type || "info"}</span>
                          <span>·</span>
                          <span>{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                      {!n.viewStatus && (
                        <span
                          aria-label="Unread"
                          className="mt-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-gray-400 mt-5 text-center">
          Want fewer of these? Manage email + push preferences in{" "}
          <Link href="/profile" className="text-emerald-700 hover:underline">
            profile settings
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function EmptyState({ tab }) {
  const copy = {
    all: {
      title: "No notifications yet",
      hint: "Order updates, messages, and payment events will show up here.",
    },
    unread: {
      title: "You're all caught up",
      hint: "Every notification on your account has been read.",
    },
    order: {
      title: "No order notifications",
      hint: "When you receive an order update, it'll appear here.",
    },
    payment: {
      title: "No payment notifications",
      hint: "Receipts, payouts, and refunds will appear here.",
    },
    message: {
      title: "No message notifications",
      hint: "Inbox pings will show up once new messages arrive.",
    },
  }[tab] || { title: "Nothing here", hint: "" };

  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
        <IoNotificationsOutline className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{copy.title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{copy.hint}</p>
    </div>
  );
}
