"use client";
// Notifications dropdown panel in the navbar.
//
// Fetches /v1/notification via the existing RTK Query hook and renders
// a scrollable list. Each row: type icon → message + relative time.
// Click → marks the notification as read (PATCH /v1/notification/:id)
// and routes to the linked record. Unread rows have a green left border
// and a colored bg; the trigger button shows an unread badge.
//
// The "Mark all as read" affordance just fires the mark mutation for
// every unread row sequentially — small N, the simplest correct thing.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IoNotificationsOutline,
  IoCheckmarkDoneOutline,
} from "react-icons/io5";
import { MdShoppingCartCheckout, MdMessage } from "react-icons/md";
import { GoVerified } from "react-icons/go";
import {
  useGetNotificationQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from "@/app/redux/features/getNotificationApi";

function timeAgo(date) {
  if (!date) return "";
  const d = new Date(date);
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

// Pick a sensible deep link based on notification type + linkId.
function hrefFor(n) {
  if (!n) return "/order";
  switch (n.type) {
    case "order":
    case "payment":
      return n.linkId ? `/order` : "/order";
    case "message":
      return "/inbox";
    default:
      return "/order";
  }
}

export default function NotificationsMenu({ active = true }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const router = useRouter();

  // Only run the query when this menu is allowed to load — keeps API quiet
  // for unauthenticated visitors (the navbar passes active=false there).
  const { data, isFetching } = useGetNotificationQuery(undefined, {
    skip: !active,
  });
  const items = data?.results || [];
  const unread = data?.unReadCount || 0;

  const [markRead] = useMarkNotificationAsReadMutation();
  const [markAllRead, { isLoading: markingAll }] =
    useMarkAllNotificationsAsReadMutation();

  // Close on outside click + Escape.
  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleClick(n) {
    setOpen(false);
    if (!n.viewStatus) {
      try {
        await markRead(n._id).unwrap();
      } catch {
        /* network blip — UI moves on regardless */
      }
    }
    router.push(hrefFor(n));
  }

  async function markAll() {
    if (unread === 0 || markingAll) return;
    try {
      // Single bulk request. The mutation's onQueryStarted handler
      // optimistically zeroes the cache so the badge drops to 0 instantly.
      await markAllRead().unwrap();
    } catch {
      /* error already toasted by interceptor; cache patch undone */
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100"
      >
        <IoNotificationsOutline className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[380px] max-w-[92vw] bg-white border border-gray-100 rounded-2xl overflow-hidden z-50 flex flex-col"
          style={{
            boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
            maxHeight: "min(560px, 80vh)",
          }}
        >
          {/* Pinned header — doesn't scroll. */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-gray-900">Notifications</div>
              {unread > 0 && (
                <span className="text-xs font-semibold bg-rose-100 text-rose-700 rounded-full px-1.5 py-0.5">
                  {unread > 99 ? "99+" : unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={markingAll}
                className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 disabled:opacity-60"
              >
                <IoCheckmarkDoneOutline />
                {markingAll ? "Marking…" : "Mark all as read"}
              </button>
            )}
          </div>

          {/* Scrollable list — fixed flex-1 so header + footer stay pinned. */}
          <div
            className="flex-1 overflow-y-auto qwlee-scroll"
            style={{ minHeight: 0 }}
          >
            {isFetching && items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
            ) : items.length === 0 ? (
              <EmptyPanel
                title="No notifications yet"
                hint="When you get orders, messages, or payment events, they'll show up here."
              />
            ) : (
              <ul>
                {items.map((n) => {
                  const Icon = iconFor(n.type);
                  return (
                    <li key={n._id}>
                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-l-2 transition ${
                          n.viewStatus
                            ? "border-transparent hover:bg-gray-50"
                            : "border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
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
                              n.viewStatus ? "text-gray-700" : "text-gray-900 font-medium"
                            }`}
                          >
                            {n.message || "New activity"}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                        {!n.viewStatus && (
                          <span
                            aria-label="Unread"
                            className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pinned footer — full list link. */}
          <div className="px-4 py-2.5 border-t border-gray-100 text-center shrink-0">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              See all notifications →
            </Link>
          </div>

          {/* Slim scrollbar styling — scoped to this panel via a class. */}
          <style jsx>{`
            .qwlee-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .qwlee-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .qwlee-scroll::-webkit-scrollbar-thumb {
              background: #e2e8f0;
              border-radius: 6px;
            }
            .qwlee-scroll::-webkit-scrollbar-thumb:hover {
              background: #cbd5e1;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ title, hint }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}
