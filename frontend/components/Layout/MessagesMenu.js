"use client";
// Inbox dropdown panel in the navbar.
//
// Fetches /v1/chat/get-chat via useGetChatsQuery, picks the "other" user
// from each chat's participants and renders a preview row: avatar +
// other user's name + last message + time. Click → /inbox/<chatId>
// (the existing inbox page is `/inbox/[chatId]` — a path param, not a
// query string, so we navigate into the dynamic route directly).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdOutlineEmail } from "react-icons/md";
import {
  useGetChatsQuery,
  inboxApi,
} from "@/app/redux/features/inbox/inboxApi";
import { useDispatch } from "react-redux";
import { useSocket } from "@/components/Context/SocketProvider";
import useUser from "@/hooks/useUser";
import Avatar from "@/components/common/Avatar";

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

export default function MessagesMenu({ active = true }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const router = useRouter();
  const me = useUser();
  const myId = me?.id || me?._id;

  const { socket } = useSocket();
  const dispatch = useDispatch();
  const { data, isFetching, refetch } = useGetChatsQuery(undefined, {
    skip: !active,
  });

  // Refetch the dropdown's chat list whenever a new message lands — the
  // sidebar and dropdown share the same underlying RTK Query cache, so a
  // single refetch updates both without coordination.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => {
      dispatch(inboxApi.util.invalidateTags(["Chat"]));
    };
    socket.on("new-chat", onUpdate);
    socket.on("new-message", onUpdate);
    socket.on("new-message-self", onUpdate);
    return () => {
      socket.off("new-chat", onUpdate);
      socket.off("new-message", onUpdate);
      socket.off("new-message-self", onUpdate);
    };
  }, [socket, dispatch]);
  // Real shape returned by /v1/chat/get-chat (after the RTK
  // transformResponse strips down to data.attributes):
  //   { data: [{ chat: {participants, ...}, lastMessage }, …], totalChats, … }
  // The backend already filters `participants` to exclude the viewer,
  // so `participants[0]` is the OTHER party directly.
  const rawChats = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  const chats = rawChats
    .map((entry) => {
      const c = entry?.chat || {};
      const other = (c.participants || [])[0];
      const last = entry?.lastMessage;
      // Render a useful preview for non-text payloads too.
      let preview = last?.content?.message || "";
      if (!preview) {
        if (last?.content?.messageType === "image") preview = "Sent a photo";
        else if (last?.content?.messageType === "offer") preview = "Sent a custom offer";
        else if (last?.content?.gigReference) preview = "Sent a gig reference";
        else if (last?.content?.files?.length) preview = "Sent an attachment";
      }
      return {
        id: c._id || c.id,
        other,
        lastMessage: preview,
        lastAt: last?.createdAt || c.updatedAt || c.createdAt,
        unread: entry?.unreadCount || 0,
      };
    })
    .filter((c) => c.id && c.other)
    .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));

  const totalUnread = chats.reduce((n, c) => n + (c.unread || 0), 0);

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

  function goToChat(c) {
    setOpen(false);
    if (!c?.id) return;
    router.push(`/inbox/${encodeURIComponent(c.id)}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Inbox"
        className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100"
      >
        <MdOutlineEmail className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-xs min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[380px] max-w-[92vw] bg-white border border-gray-100 rounded-2xl overflow-hidden z-50"
          style={{ boxShadow: "0 12px 36px rgba(15,23,42,0.12)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="font-semibold text-gray-900">Messages</div>
            {totalUnread > 0 && (
              <span className="text-xs text-emerald-700 font-medium">
                {totalUnread} unread
              </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isFetching && chats.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
            ) : chats.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="text-sm font-medium text-gray-900">
                  No conversations yet
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  When you message a seller — or one messages you — it'll show
                  up here.
                </p>
              </div>
            ) : (
              <ul>
                {chats.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => goToChat(c)}
                      className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition"
                    >
                      <Avatar
                        src={c.other?.image}
                        name={c.other?.fullName}
                        size={40}
                        rounded
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div
                            className={`text-sm truncate ${
                              c.unread > 0
                                ? "font-semibold text-gray-900"
                                : "text-gray-800"
                            }`}
                          >
                            {c.other?.fullName || "Conversation"}
                          </div>
                          <div className="text-xs text-gray-400 shrink-0">
                            {timeAgo(c.lastAt)}
                          </div>
                        </div>
                        <div
                          className={`text-xs mt-0.5 line-clamp-1 ${
                            c.unread > 0 ? "text-gray-700" : "text-gray-500"
                          }`}
                        >
                          {c.lastMessage || "Open conversation"}
                        </div>
                      </div>
                      {c.unread > 0 && (
                        <span className="ml-1 shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                          {c.unread}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {chats.length > 5
                ? `Showing 5 of ${chats.length}`
                : `${chats.length} conversation${chats.length === 1 ? "" : "s"}`}
            </span>
            <Link
              href="/inbox"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open inbox →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
