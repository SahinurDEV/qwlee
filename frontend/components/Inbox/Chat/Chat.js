"use client";
// Inbox sidebar — list of conversations, most recent first.
//
// Real-time behaviour:
//   - On socket "new-chat" (own + peer side, see message.controller.js)
//     we upsert the chat entry, update its lastMessage, and re-sort by
//     lastMessage.createdAt so the active thread bubbles to the top.
//   - On socket "new-message" / "new-message-self" we also patch
//     lastMessage for the matching chat — covers the case where the
//     new-chat snapshot lags behind the new-message broadcast.
//
// Sorting lives entirely in the renderer (a useMemo over the state)
// rather than mutating the state on every event, so React re-renders
// stay shallow and avoidable.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { IoSearch } from "react-icons/io5";

import { useGetChatsQuery, useLazySearchMessagesQuery } from "@/app/redux/features/inbox/inboxApi";
import Link from "next/link";
import moment from "moment";
import { useSocket } from "@/components/Context/SocketProvider";
import useUser from "@/hooks/useUser";
import ChatCart from "./ChatCart";
import ChatCartSkeleton from "./ChatCartSkeleton ";
import noChat from "../../../assest/image/nochat.png";

function lastTime(entry) {
  return new Date(
    entry?.lastMessage?.createdAt ||
      entry?.chat?.updatedAt ||
      entry?.chat?.createdAt ||
      0
  ).getTime();
}

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data, isFetching, isError } = useGetChatsQuery(
    { archived: showArchived },
    { refetchOnMountOrArgChange: true }
  );
  // Message search across all conversations (debounced, 2+ characters).
  const [runSearch, { data: hits = [], isFetching: searching }] = useLazySearchMessagesQuery();
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => runSearch({ q }), 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);
  const { socket } = useSocket();
  const user = useUser();
  // The chat currently open in the right pane; we clear its unread count
  // immediately rather than waiting for the read-receipt round-trip.
  const params = useParams();
  const activeChatId = params?.chatId;

  useEffect(() => {
    if (data) setChats(data.data || []);
  }, [data]);

  // Upsert helper — either bumps the lastMessage of an existing chat or
  // adds a new chat snapshot at the head. The reorder happens in the
  // sorted memo below. New incoming messages (not from me, not the open
  // chat) bump the unread counter so the badge stays in sync without
  // waiting for the next REST refetch.
  function upsertChat(snapshot, opts = {}) {
    const chatId = snapshot?.chat?.id || snapshot?.chat?._id;
    if (!chatId) return;
    const { bumpUnread = false } = opts;
    setChats((prev) => {
      const i = prev.findIndex(
        (c) => (c.chat?.id || c.chat?._id) === chatId
      );
      if (i >= 0) {
        const copy = [...prev];
        const next = {
          ...copy[i],
          ...snapshot,
          lastMessage: snapshot.lastMessage || copy[i].lastMessage,
        };
        if (bumpUnread) next.unreadCount = (copy[i].unreadCount || 0) + 1;
        copy[i] = next;
        return copy;
      }
      return [
        { ...snapshot, unreadCount: bumpUnread ? 1 : snapshot.unreadCount || 0 },
        ...prev,
      ];
    });
  }

  function patchLastMessage(message, opts = {}) {
    const chatId = message?.chat?._id || message?.chat?.id || message?.chat;
    if (!chatId) return;
    const { bumpUnread = false } = opts;
    setChats((prev) =>
      prev.map((c) => {
        const id = c.chat?.id || c.chat?._id;
        if (id !== chatId) return c;
        const next = { ...c, lastMessage: message };
        if (bumpUnread) next.unreadCount = (c.unreadCount || 0) + 1;
        return next;
      })
    );
  }

  // Clear the unread badge of the chat the user just opened.
  useEffect(() => {
    if (!activeChatId) return;
    setChats((prev) =>
      prev.map((c) =>
        (c.chat?.id || c.chat?._id) === activeChatId
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
  }, [activeChatId]);

  useEffect(() => {
    if (!socket) return;
    const myId = String(user?.id || user?._id || "");
    const onNewChat = (snapshot) => {
      // The receiver-side new-chat is the one that should bump the
      // unread count. The sender-side mirror (`new-message-self`) never
      // does. We tell them apart by looking at the senderId on the
      // snapshot's lastMessage.
      const senderId = String(
        snapshot?.lastMessage?.sender?._id ||
          snapshot?.lastMessage?.sender?.id ||
          snapshot?.lastMessage?.sender ||
          ""
      );
      const fromOther = senderId && senderId !== myId;
      const chatId = snapshot?.chat?.id || snapshot?.chat?._id;
      const bumpUnread = fromOther && chatId !== activeChatId;
      upsertChat(snapshot, { bumpUnread });
    };
    const onNewMessage = (message) => {
      const senderId = String(
        message?.sender?._id || message?.sender?.id || message?.sender || ""
      );
      const chatId = message?.chat?._id || message?.chat?.id || message?.chat;
      const fromOther = senderId && senderId !== myId;
      const bumpUnread = fromOther && chatId !== activeChatId;
      patchLastMessage(message, { bumpUnread });
    };
    socket.on("new-chat", onNewChat);
    socket.on("new-message", onNewMessage);
    socket.on("new-message-self", onNewMessage);
    return () => {
      socket.off("new-chat", onNewChat);
      socket.off("new-message", onNewMessage);
      socket.off("new-message-self", onNewMessage);
    };
  }, [socket, user?.id, user?._id, activeChatId]);

  // Most-recent first. Filter by participant name when the search box
  // has text in it. Empty chats — created by the Contact button but
  // never used — are excluded; they'll appear via the realtime
  // `new-chat` event the moment the first message is sent.
  const visible = useMemo(() => {
    const withMessages = chats.filter((c) => !!c?.lastMessage);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? withMessages.filter((c) => {
          const name =
            c?.chat?.participants?.[0]?.fullName?.toLowerCase() || "";
          const username =
            c?.chat?.participants?.[0]?.username?.toLowerCase() || "";
          return name.includes(q) || username.includes(q);
        })
      : withMessages;
    return [...filtered].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return lastTime(b) - lastTime(a);
    });
  }, [chats, query]);

  let content = null;
  if (isFetching && chats.length === 0) {
    content = (
      <>
        {[...Array(5)].map((_, i) => (
          <ChatCartSkeleton key={i} />
        ))}
      </>
    );
  } else if (isError) {
    content = (
      <h3 className="font-semibold text-rose-500 text-center py-5">
        Something went wrong
      </h3>
    );
  } else if (visible.length === 0 && !(query.trim().length >= 2 && hits.length)) {
    content = (
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Image width={120} height={120} src={noChat} alt="No Chat" />
        <h1 className="text-xl font-bold mt-4">
          {query ? "No matches" : showArchived ? "No archived conversations" : "No conversations found"}
        </h1>
      </div>
    );
  } else {
    content = visible.map((chat, i) => (
      <div
        key={chat.chat?.id || chat.chat?._id}
        // Tiny stagger so multiple incoming messages don't pop simultaneously.
        // The wrapper carries a CSS transform-transition; React preserves the
        // DOM node across reorders thanks to the stable key, so the move
        // animates smoothly rather than re-mounting.
        className="transition-all duration-300 ease-out animate-[chatRowIn_220ms_ease-out]"
        style={{ animationDelay: `${Math.min(i, 5) * 18}ms` }}
      >
        <ChatCart chatData={chat} />
      </div>
    ));
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 pb-2">
        <h1 className="text-xl font-semibold">Messages</h1>
        <div className="w-full px-3 py-2 rounded-full border flex items-center text-gray-400 bg-white mt-3">
          <IoSearch className="text-xl" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none px-2 text-gray-800"
            placeholder="Search names and messages…"
            aria-label="Search conversations and messages"
          />
        </div>
        <div className="flex gap-2 mt-3 text-sm" role="tablist">
          {[[false, "Inbox"], [true, "Archived"]].map(([val, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={showArchived === val}
              onClick={() => setShowArchived(val)}
              className={`px-3 py-1 rounded-full border ${showArchived === val ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[calc(100vh-200px)] md:h-[calc(100vh-290px)] overflow-y-scroll py-5 space-y-2 flex-grow">
        {content}
        {query.trim().length >= 2 && (
          <div className="px-4 pt-2">
            <h2 className="text-xs font-semibold uppercase text-gray-500 mb-1">Messages</h2>
            {searching ? (
              <p className="text-sm text-gray-500">Searching…</p>
            ) : hits.length ? (
              <ul className="divide-y divide-gray-100">
                {hits.map((h) => {
                  const mine = String(h.sender?.id || h.sender?._id) === String(user?.id || user?._id);
                  const other = mine ? h.receiver : h.sender;
                  return (
                    <li key={h.id || h._id}>
                      <Link href={`/inbox/${h.chat}`} className="block py-2 hover:bg-gray-50 rounded">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span className="font-medium text-gray-700 truncate">{other?.fullName || "Conversation"}</span>
                          <span className="shrink-0">{moment(h.createdAt).format("MMM D")}</span>
                        </div>
                        <p className="text-sm text-gray-800 truncate">{mine ? "You: " : ""}{h.content?.message}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No messages match.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
