"use client";
// Single row in the inbox sidebar. Renders the counterparty avatar,
// online dot, name, last-message preview, time, and (when applicable)
// a green unread badge with the count of unseen messages.
//
// Unread rows render with a soft emerald tint + bold name so the user
// can scan the list and spot conversations needing attention.

import Link from "next/link";
import { useDispatch } from "react-redux";
import moment from "moment";

import Avatar from "@/components/common/Avatar";
import useUser from "@/hooks/useUser";
import { setIsOpen } from "@/app/redux/features/inbox/userToChatSlice";

function formatTime(time) {
  if (!time) return "";
  const now = moment();
  const t = moment(time);
  const mins = now.diff(t, "minutes");
  const hrs = now.diff(t, "hours");
  const days = now.diff(t, "days");
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days < 2) return "Yesterday";
  if (days < 7) return `${days}d`;
  return t.format("MMM D");
}

export default function ChatCart({ chatData }) {
  const user = useUser();
  const dispatch = useDispatch();
  const { chat, lastMessage, unreadCount = 0, pinned, blocked } = chatData || {};
  const other = chat?.participants?.[0] || {};
  const { fullName, username, image, online } = other;
  // Manually-registered accounts often have no profile photo. Pass the
  // most readable name we have so the initials fallback is meaningful
  // instead of rendering "?".
  const displayName = fullName || (username ? `@${username}` : "Conversation");
  const avatarName = fullName || username || "Member";
  const last = lastMessage || {};
  const senderId = last?.sender?._id || last?.sender?.id || last?.sender;
  const myLastMessage = String(senderId || "") === String(user?.id || user?._id || "");
  const unread = !myLastMessage && unreadCount > 0;

  // Build a one-line preview of the last message.
  const previewBase = (() => {
    const c = last.content || {};
    if (last.deletedForEveryone) return "message deleted";
    if (c.messageType === "audio") return "a voice note";
    if (c.messageType === "text" && c.message) {
      return c.message.length > 28 ? `${c.message.slice(0, 28)}…` : c.message;
    }
    if (c.messageType === "image" && c.files?.length) {
      return c.files.length === 1 ? "a photo" : `${c.files.length} photos`;
    }
    if (c.messageType === "offer") return "a custom offer";
    if (c.gigReference) return "a gig reference";
    if (c.files?.length) return "an attachment";
    return "";
  })();
  const preview = previewBase
    ? myLastMessage
      ? `You: ${previewBase}`
      : previewBase
    : "";

  return (
    <Link href={`/inbox/${chat?.id || chat?._id}`}>
      <div
        onClick={() => dispatch(setIsOpen())}
        className={`w-full p-2.5 flex gap-3 cursor-pointer my-2 rounded-xl transition-colors duration-200 hover:bg-emerald-50/60 ${
          unread
            ? "bg-emerald-50 border border-emerald-100"
            : "bg-gray-50 border border-transparent"
        }`}
      >
        <div className="relative shrink-0">
          <Avatar src={image} name={avatarName} size={48} rounded />
          {online && (
            <span
              aria-label="Online"
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={`truncate ${
                unread ? "font-bold text-gray-900" : "font-semibold text-gray-800"
              }`}
            >
              {pinned ? <span className="mr-1" aria-label="Pinned" title="Pinned">📌</span> : null}
              {displayName}
              {blocked ? <span className="ml-1 text-[10px] font-semibold uppercase text-rose-600">Blocked</span> : null}
            </h3>
            <span
              className={`text-xs shrink-0 ${
                unread ? "text-emerald-700 font-semibold" : "text-gray-400"
              }`}
            >
              {formatTime(last.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p
              className={`text-sm truncate ${
                unread ? "text-gray-900 font-medium" : "text-gray-500"
              }`}
            >
              {preview || "Open conversation"}
            </p>
            {unread && (
              <span className="ml-1 shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
