"use client";
// Inbox conversation pane — Fiverr-style.
//
// Highlights:
//   - Header shows avatar + online dot + "Active now / last seen Xm ago",
//     plus the other party's local time when their timezone is known.
//   - Refresh button forces a refetch (handy when you arrive from a gig
//     handoff and want to see the seller's reply land).
//   - Plays a soft chime via Web Audio when an incoming message lands
//     (skipped for your own messages and when ?qwlee:mute=1).
//   - "Reference a gig" handoff: arriving with /inbox/<chat>?ref=<gigId>
//     pre-populates the composer with a gig link block so the seller has
//     immediate context.
//   - "Create custom offer" button exposed to sellers (mode-aware, not
//     just role-aware) so a freelancer in selling mode can pitch.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import moment from "moment";
import { Image as AntdImage } from "antd";
import { toast } from "sonner";
import { FaXmark } from "react-icons/fa6";
import { GrAttachment, GrEmoji } from "react-icons/gr";
import { IoIosArrowBack, IoMdSend } from "react-icons/io";
import {
  IoRefreshOutline,
  IoNotificationsOutline,
  IoNotificationsOffOutline,
  IoTimeOutline,
  IoPricetagOutline,
  IoVideocamOutline,
} from "react-icons/io5";

import {
  useAddMessageMutation,
  useGetChatQuery,
  useGetMessagesQuery,
  useDeleteMessageMutation,
  useChatActionMutation,
  useReportChatMutation,
  useLazySearchMessagesQuery,
} from "@/app/redux/features/inbox/inboxApi";
import ChatMenu from "./ChatMenu";
import ReportModal from "./ReportModal";
import OrderContextCard from "./OrderContextCard";
import { replySnippet } from "./MessageCart";
import { contactWarnings } from "@/utils/contactWarning";
import { confirmModal } from "@/components/common/confirm";
import { useGetAllGigUserQuery } from "@/app/redux/features/getAllGigForUserApi";
import { useGetGigDetailsQuery } from "@/app/redux/features/getGigDetailsApi";
import { useSocket } from "@/components/Context/SocketProvider";
import { setIsOpen } from "@/app/redux/features/inbox/userToChatSlice";
import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import playMessageSound, { isMuted, setMuted } from "@/utils/playMessageSound";

import MessageCart from "@/components/Inbox/Message/MessageCart";
import QuickReplies from "@/components/Inbox/Message/QuickReplies";
import { useMarkThreadReadMutation } from "@/app/redux/features/quickRepliesApi";
import MessageCartSkeleton from "@/components/Inbox/Message/MessageCartSkeleton";
import EmojiPicker from "@/components/Inbox/Message/EmojiPicker";
import Avatar from "@/components/common/Avatar";
import AllGigsModal from "./AllGigsModal";
import CustomOfferModal from "./CustomOfferModal";

export default function Message() {
  const user = useUser();
  const { isSelling } = useViewMode(user);
  const { chatId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [page] = useState(1);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isAllGigsModalOpen, setIsAllGigsModalOpen] = useState(false);
  const [selectedGig, setSelectedGig] = useState(null);
  const [muted, setMutedState] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [callStarting, setCallStarting] = useState(false);
  const composerRef = useRef(null);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [livePresence, setLivePresence] = useState(null); // overrides server.online when socket events fire
  const lastMessageRef = useRef(null);
  const typingStopTimer = useRef(null);
  const lastTypingEmit = useRef(0);
  const peerTypingTimer = useRef(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteMessage] = useDeleteMessageMutation();
  const [chatAction] = useChatActionMutation();
  const [reportChat, { isLoading: reporting }] = useReportChatMutation();
  const [runSearch, { data: searchResults = [], isFetching: searching }] = useLazySearchMessagesQuery();

  // Hydrate the mute flag client-side (localStorage is undefined on SSR).
  useEffect(() => setMutedState(isMuted()), []);

  const { data: participant } = useGetChatQuery(chatId);
  const {
    data: messageData,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetMessagesQuery({ chatId, page });
  const [addMessage, { isLoading: sending }] = useAddMessageMutation();
  const [markThreadRead] = useMarkThreadReadMutation();
  const { data: myGigsData } = useGetAllGigUserQuery(user?.id, {
    skip: !user?.id,
  });
  const myGigs = myGigsData?.data?.attributes?.results;

  const counterparty = participant?.participants?.[0] || {};
  const myId = String(user?.id || "");
  const inList = (list) => (list || []).map((x) => String(x?._id || x?.id || x)).includes(myId);
  const pinned = inList(participant?.pinnedBy);
  const archived = inList(participant?.archivedBy);
  const blockedByMe = inList(participant?.blockedBy);
  const blocked = (participant?.blockedBy || []).length > 0 || participant?.status === "blocked";
  const {
    id: receiverId,
    fullName,
    image,
    online,
    lastSeen,
    location,
  } = counterparty;

  // Gig reference handoff. If we arrived from a gig page, fetch the gig
  // and seed the composer with a "Referencing this gig" snippet so the
  // seller knows what the inquiry is about.
  const refGigId = search.get("ref");
  const { data: refGigData } = useGetGigDetailsQuery(refGigId, {
    skip: !refGigId,
  });
  const refGig = refGigData?.data?.attributes?.results?.[0];
  useEffect(() => {
    if (!refGig || composer) return;
    // The gig card itself renders alongside the bubble, so the
    // composer prefill stays short — just a friendly opener.
    setComposer(
      `Hi ${fullName?.split(" ")[0] || "there"}! I'm interested in this gig — could you share a bit more about how you'd approach my project?`
    );
    // Strip ?ref from the URL so the seed only happens once per visit.
    const next = new URLSearchParams(search.toString());
    next.delete("ref");
    const qs = next.toString();
    router.replace(`/inbox/${chatId}${qs ? `?${qs}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refGig]);

  useEffect(() => {
    if (messageData) setMessages(messageData.data || []);
  }, [messageData]);

  // Sound + live update on incoming messages.
  useEffect(() => {
    if (!socket) return;
    const handler = (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => (m._id || m.id) === (newMessage._id || newMessage.id))) {
          return prev;
        }
        return [...prev, newMessage];
      });
      const senderId = newMessage?.sender?._id || newMessage?.sender?.id || newMessage?.sender;
      const mine = String(senderId) === String(user?.id);
      const sameChat = String(newMessage?.chat?._id || newMessage?.chat?.id || newMessage?.chat) === String(chatId);
      if (!mine && sameChat) markThreadRead(chatId);
      if (!mine) {
        playMessageSound();
        // The peer just sent something — they're clearly not still typing.
        setIsPeerTyping(false);
      }
    };
    socket.on("new-message", handler);
    // Read receipts: the other side opened the thread.
    const onRead = ({ chatId: c }) => {
      if (String(c) !== String(chatId)) return;
      setMessages((prev) => prev.map((m) => ((m.sender?._id || m.sender?.id || m.sender) === user?.id ? { ...m, readed: true } : m)));
    };
    socket.on("messages-read", onRead);
    // Edits, deletes and reactions from either side.
    const onUpdated = (m) => {
      const id = String(m?._id || m?.id || "");
      if (!id) return;
      setMessages((prev) => prev.map((x) => (String(x._id || x.id) === id ? { ...x, ...m } : x)));
    };
    socket.on("message-updated", onUpdated);
    return () => {
      socket.off("new-message", handler);
      socket.off("messages-read", onRead);
      socket.off("message-updated", onUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.id, chatId]);

  // Live presence — server broadcasts user/connect and user/disconnect
  // when the counterparty's socket count crosses zero. Override the
  // initial server.online flag with the socket truth so the dot reflects
  // reality even if the cached chat record is stale.
  useEffect(() => {
    if (!socket || !receiverId) return;
    function onConnect(id) {
      if (String(id) === String(receiverId)) setLivePresence({ online: true });
    }
    function onDisconnect(id) {
      if (String(id) === String(receiverId)) {
        setLivePresence({ online: false, lastSeen: new Date().toISOString() });
      }
    }
    socket.on("user/connect", onConnect);
    socket.on("user/disconnect", onDisconnect);
    return () => {
      socket.off("user/connect", onConnect);
      socket.off("user/disconnect", onDisconnect);
    };
  }, [socket, receiverId]);

  // Typing indicator from the peer. Auto-expires if we miss a stop event.
  useEffect(() => {
    if (!socket || !receiverId) return;
    function onStart(payload) {
      if (String(payload?.senderId) !== String(receiverId)) return;
      setIsPeerTyping(true);
      clearTimeout(peerTypingTimer.current);
      peerTypingTimer.current = setTimeout(() => setIsPeerTyping(false), 4000);
    }
    function onStop(payload) {
      if (String(payload?.senderId) !== String(receiverId)) return;
      clearTimeout(peerTypingTimer.current);
      setIsPeerTyping(false);
    }
    socket.on("typing/start", onStart);
    socket.on("typing/stop", onStop);
    return () => {
      socket.off("typing/start", onStart);
      socket.off("typing/stop", onStop);
      clearTimeout(peerTypingTimer.current);
    };
  }, [socket, receiverId]);

  // Emit typing/stop on unmount or thread change so we never leave a
  // dangling "still typing" indicator on the other side.
  useEffect(() => {
    return () => {
      if (socket && receiverId) {
        socket.emit("typing/stop", { chatId, receiverId });
      }
      clearTimeout(typingStopTimer.current);
    };
  }, [socket, receiverId, chatId]);

  function emitTyping() {
    if (!socket || !receiverId) return;
    const now = Date.now();
    // Throttle to one start emit per 2s.
    if (now - lastTypingEmit.current > 2000) {
      socket.emit("typing/start", { chatId, receiverId });
      lastTypingEmit.current = now;
    }
    // Reset the idle timer — when the user stops for 2.5s we stop.
    clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      socket.emit("typing/stop", { chatId, receiverId });
      lastTypingEmit.current = 0;
    }, 2500);
  }

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleFile(e) {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  }
  function removeAttachment(i) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Insert emoji at the textarea caret. Falls back to appending if the
  // ref isn't ready (e.g. picker opened before the textarea mounted).
  function insertEmoji(emoji) {
    const el = composerRef.current;
    if (!el) {
      setComposer((prev) => (prev || "") + emoji);
      return;
    }
    const start = el.selectionStart ?? composer.length;
    const end = el.selectionEnd ?? composer.length;
    const next = composer.slice(0, start) + emoji + composer.slice(end);
    setComposer(next);
    // Re-focus + move caret past the inserted emoji on the next tick.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Video call — generates a deterministic Jitsi Meet room name keyed
  // on the chatId so both parties can rejoin the same room later.
  // Posts a chat message with a special marker the bubble renderer
  // recognises, then opens the room for the caller in a new tab.
  async function startVideoCall() {
    if (!receiverId) {
      toast.error("Conversation not loaded yet.");
      return;
    }
    setCallStarting(true);
    try {
      const slug = (chatId || "qwlee").toString().slice(-12);
      const room = `Qwlee-${slug}-${Date.now().toString(36)}`;
      const url = `https://meet.jit.si/${room}`;
      const body = `📹 Started a video call. Tap to join: ${url}`;
      const formData = new FormData();
      formData.append("receiver", receiverId);
      formData.append("message", body);
      const res = await addMessage(formData);
      if (res?.error) {
        toast.error(res.error?.data?.message || "Could not start call");
        return;
      }
      // Open the room for the initiator immediately.
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Call started — link shared in chat.");
    } finally {
      setCallStarting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = composer.trim();
    if (!text && attachments.length === 0) return;
    const warn = contactWarnings(text);
    if (warn.length) {
      const ok = await confirmModal({
        title: "Keep your conversation on Qwlee",
        description: `This message seems to include ${warn.join(", ")}. Sharing contact details or paying outside Qwlee breaks our Terms and removes your payment protection. Send it anyway?`,
        confirmText: "Send anyway",
        cancelText: "Edit message",
      });
      if (!ok) return;
    }
    const formData = new FormData();
    formData.append("receiver", receiverId);
    if (text) formData.append("message", text);
    if (replyingTo) formData.append("replyTo", replyingTo._id || replyingTo.id);
    attachments.forEach((f) => formData.append("files", f));
    const res = await addMessage(formData);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not send");
      return;
    }
    setComposer("");
    setAttachments([]);
    setReplyingTo(null);
    // We just sent — don't leave a stale "is typing" hanging on the
    // other end.
    if (socket && receiverId) {
      socket.emit("typing/stop", { chatId, receiverId });
    }
    clearTimeout(typingStopTimer.current);
    lastTypingEmit.current = 0;
  }

  async function handleSubmitOffer(values) {
    if (!selectedGig) return;
    const offerDetails = JSON.stringify({
      gigId: selectedGig._id,
      clientId: receiverId,
      freelancerId: user?.id,
      gigTitle: selectedGig?.title,
      slug: selectedGig?.slug,
      ...values,
    });
    const formData = new FormData();
    formData.append("receiver", receiverId);
    formData.append("offerDetails", offerDetails);
    const res = await addMessage(formData);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not send offer");
      return;
    }
    toast.success("Offer sent");
    setIsOfferModalOpen(false);
    setSelectedGig(null);
  }

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    toast.success(next ? "Notifications muted" : "Notifications unmuted");
  }

  function handleRefresh() {
    refetch();
    toast.success("Refreshed");
  }

  // Online state — "Active now" if online, else "Last seen Xm ago".
  // Socket events override the initial server-rendered values.
  const effectiveOnline =
    livePresence?.online != null ? livePresence.online : online;
  const effectiveLastSeen = livePresence?.lastSeen || lastSeen;
  const activityLabel = useMemo(() => {
    if (isPeerTyping) return { tone: "active", text: "typing…" };
    if (effectiveOnline) return { tone: "active", text: "Active now" };
    if (!effectiveLastSeen) return null;
    const diffMin = moment().diff(moment(effectiveLastSeen), "minutes");
    if (diffMin < 1) return { tone: "recent", text: "Active moments ago" };
    if (diffMin < 60) return { tone: "recent", text: `Last seen ${diffMin}m ago` };
    if (diffMin < 60 * 24)
      return { tone: "idle", text: `Last seen ${Math.floor(diffMin / 60)}h ago` };
    return { tone: "idle", text: `Last seen ${moment(effectiveLastSeen).fromNow()}` };
  }, [effectiveOnline, effectiveLastSeen, isPeerTyping]);

  // Other-party local time (rough — we only have a free-text location;
  // best effort via moment locale, otherwise just show the user's own
  // local clock as a reference).
  // Set after mount: rendering the clock on the server (UTC) and again in
  // the browser (local zone) gave different text, a hydration error (#418).
  const [localTime, setLocalTime] = useState("");
  useEffect(() => {
    const tick = () => setLocalTime(moment().format("h:mm A"));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  async function handleChatAction(action) {
    if (action === "block") {
      const ok = await confirmModal({
        title: `Block ${fullName || "this member"}?`,
        description: "Neither of you will be able to send messages in this conversation until you unblock it.",
        confirmText: "Block",
        danger: true,
      });
      if (!ok) return;
    }
    const res = await chatAction({ chatId, action });
    if (res?.error) return toast.error(res.error?.data?.message || "Something went wrong");
    toast.success(res.data?.message || "Done");
  }

  async function handleReport(values) {
    const res = await reportChat({ chatId, ...values });
    if (res?.error) return toast.error(res.error?.data?.message || "Could not send the report");
    toast.success("Thanks. Our team will review this conversation.");
    setReportOpen(false);
  }

  async function handleDelete(m, scope) {
    const id = m._id || m.id;
    const res = await deleteMessage({ id, scope });
    if (res?.error) return toast.error(res.error?.data?.message || "Could not delete");
    if (scope === "me") {
      setMessages((prev) => prev.filter((x) => String(x._id || x.id) !== String(id)));
    } else {
      setMessages((prev) =>
        prev.map((x) =>
          String(x._id || x.id) === String(id)
            ? { ...x, deletedForEveryone: true, content: { messageType: "text", message: "", files: [] } }
            : x
        )
      );
    }
  }

  function startReply(m) {
    setReplyingTo(m);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function submitSearch(e) {
    e.preventDefault();
    const q = searchQ.trim();
    if (q.length < 2) return toast.error("Type at least 2 characters");
    runSearch({ q, chatId });
  }

  function jumpToMessage(id) {
    setHighlightId(String(id));
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    else toast.message("That message is further back in the conversation.");
    setTimeout(() => setHighlightId(null), 2500);
  }

  let content;
  if (isFetching && messages.length === 0) {
    content = (
      <>
        <MessageCartSkeleton />
        <MessageCartSkeleton />
        <MessageCartSkeleton />
      </>
    );
  } else if (isError && error) {
    content = (
      <div className="text-center py-10">
        <p className="text-sm text-rose-600 font-medium">
          We couldn&rsquo;t load this conversation.
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    );
  } else if (!isFetching && messages.length === 0) {
    content = (
      <div className="text-center py-10">
        <p className="text-sm text-gray-500">No messages yet — say hi 👋</p>
      </div>
    );
  } else {
    const senderOf = (m) => String(m?.sender?._id || m?.sender?.id || m?.sender || "");
    let lastMine = -1;
    messages.forEach((m, i) => { if (senderOf(m) === String(user?.id)) lastMine = i; });
    content = messages.map((m, i) => (
      <div key={m._id || m.id || i} ref={i === messages.length - 1 ? lastMessageRef : null}>
        <MessageCart
          message={m}
          onReply={blocked ? undefined : startReply}
          onDelete={handleDelete}
          highlighted={highlightId === String(m._id || m.id)}
        />
        {i === lastMine ? (
          <p className="text-right text-xs text-gray-400 -mt-1 mb-2 pr-1" aria-live="polite">{m.readed ? "Seen" : "Sent"}</p>
        ) : null}
      </div>
    ));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-gray-100">
        <button
          type="button"
          className="md:hidden p-1.5 rounded-md hover:bg-gray-100"
          onClick={() => router.push("/inbox")}
          aria-label="Back to inbox list"
        >
          <IoIosArrowBack className="text-xl" />
        </button>

        <div className="relative">
          <Avatar src={image} name={fullName} size={44} rounded />
          {effectiveOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
              aria-label="Online"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm md:text-base font-semibold text-gray-900 truncate">
            {fullName || "Member"}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {activityLabel && (
              <span
                className={
                  activityLabel.tone === "active"
                    ? "text-emerald-600 font-medium"
                    : activityLabel.tone === "recent"
                    ? "text-gray-700"
                    : "text-gray-500"
                }
              >
                {activityLabel.text}
              </span>
            )}
            {location && <span className="text-gray-400">· {location}</span>}
            <span className="hidden md:inline-flex items-center gap-1 text-gray-400">
              <IoTimeOutline /> {localTime ? `${localTime} local` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Refresh messages"
            title="Refresh"
          >
            <IoRefreshOutline className="text-xl" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label={muted ? "Unmute notifications" : "Mute notifications"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <IoNotificationsOffOutline className="text-xl" />
            ) : (
              <IoNotificationsOutline className="text-xl" />
            )}
          </button>
          <ChatMenu
            pinned={pinned}
            archived={archived}
            blockedByMe={blockedByMe}
            onAction={handleChatAction}
            onSearch={() => setSearchOpen((v) => !v)}
            onReport={() => setReportOpen(true)}
          />
        </div>
      </header>

      <OrderContextCard chatId={chatId} />

      {searchOpen && (
        <div className="px-3 md:px-4 py-2 border-b border-gray-100 bg-white">
          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search this conversation…"
              aria-label="Search this conversation"
              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Search</button>
            <button type="button" onClick={() => { setSearchOpen(false); setSearchQ(""); }} className="p-1.5 text-gray-500" aria-label="Close search">
              <FaXmark />
            </button>
          </form>
          {searching ? (
            <p className="text-xs text-gray-500 mt-2">Searching…</p>
          ) : searchResults.length ? (
            <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-gray-100">
              {searchResults.map((r) => (
                <li key={r.id || r._id}>
                  <button type="button" onClick={() => jumpToMessage(r.id || r._id)} className="w-full text-left py-1.5 text-sm hover:bg-gray-50">
                    <span className="text-xs text-gray-400 mr-2">{moment(r.createdAt).format("MMM D, h:mm A")}</span>
                    <span className="text-gray-800">{(r.content?.message || "").slice(0, 120)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Reference banner */}
      {refGig && (
        <div className="px-4 py-2 bg-emerald-50/60 border-b border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
          <IoPricetagOutline />
          <span className="truncate">
            Referencing gig:{" "}
            <Link
              href={`/gig/${refGig.slug || refGig._id}`}
              className="font-medium underline hover:text-emerald-900"
            >
              {refGig.title}
            </Link>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="bg-gray-50/60">
        <div className="h-[calc(100vh-380px)] md:h-[calc(100vh-430px)] overflow-y-auto px-3 md:px-4 py-3 space-y-1">
          {content}
        </div>

        {blocked ? (
          <div className="bg-white border-t border-gray-100 p-4 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              {blockedByMe
                ? "You blocked this conversation. Unblock it to send messages."
                : "You can't reply to this conversation."}
            </span>
            {blockedByMe && (
              <button type="button" onClick={() => handleChatAction("unblock")} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                Unblock
              </button>
            )}
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white border-t border-gray-100"
        >
          {replyingTo && (
            <div className="flex items-center gap-2 px-3 pt-2 text-xs text-gray-600">
              <div className="flex-1 min-w-0 border-l-4 border-emerald-400 bg-gray-50 rounded px-2 py-1">
                <span className="font-semibold">Replying to {String(replyingTo.sender?._id || replyingTo.sender?.id || replyingTo.sender) === myId ? "yourself" : fullName || "them"}</span>
                <span className="block truncate">{replySnippet(replyingTo)}</span>
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} className="p-1 text-gray-500" aria-label="Cancel reply">
                <FaXmark />
              </button>
            </div>
          )}
          <textarea
            ref={composerRef}
            value={composer}
            onChange={(e) => {
              setComposer(e.target.value);
              if (e.target.value) emitTyping();
            }}
            rows={3}
            placeholder="Write a message…"
            className="w-full p-3 text-sm text-gray-800 outline-none resize-none"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden"
                >
                  {file.type?.startsWith("image/") ? (
                    <AntdImage
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-600 px-1 text-center">
                      <span className="font-semibold">FILE</span>
                      <span className="truncate w-full">{file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1 -right-1 bg-white border border-gray-200 text-rose-600 rounded-full p-1 shadow"
                    aria-label="Remove"
                  >
                    <FaXmark className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-gray-500">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  className={`p-1.5 rounded-md transition ${
                    emojiOpen ? "bg-emerald-50 text-emerald-700" : "hover:bg-gray-100"
                  }`}
                  aria-label="Insert emoji"
                  aria-expanded={emojiOpen}
                  title="Emoji"
                >
                  <GrEmoji className="text-lg" />
                </button>
                <EmojiPicker
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onPick={(emoji) => {
                    insertEmoji(emoji);
                    // Stay open so users can pick several quickly. Close
                    // happens on outside click / Escape.
                  }}
                />
              </div>
              <QuickReplies onPick={(text) => setComposer((prev) => (prev ? `${prev} ${text}` : text))} />
              <label
                htmlFor="msg-attach"
                className="p-1.5 rounded-md hover:bg-gray-100 cursor-pointer"
                aria-label="Attach files"
                title="Attach"
              >
                <GrAttachment className="text-lg" />
              </label>
              <input
                id="msg-attach"
                type="file"
                multiple
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={startVideoCall}
                disabled={callStarting || !receiverId}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-50"
                aria-label="Start video call"
                title="Start video call"
              >
                <IoVideocamOutline className="text-lg" />
              </button>
              {isSelling && (
                <button
                  type="button"
                  onClick={() => setIsAllGigsModalOpen(true)}
                  className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium hover:bg-emerald-100"
                >
                  <IoPricetagOutline /> Create custom offer
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={sending || (!composer.trim() && attachments.length === 0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <IoMdSend />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        name={fullName}
        submitting={reporting}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
      />

      <AllGigsModal
        isOpen={isAllGigsModalOpen}
        gigs={myGigs}
        onClose={() => setIsAllGigsModalOpen(false)}
        onSelectGig={(gig) => {
          setSelectedGig(gig);
          setIsAllGigsModalOpen(false);
          setIsOfferModalOpen(true);
        }}
      />
      <CustomOfferModal
        isOpen={isOfferModalOpen}
        handleSubmitOffer={handleSubmitOffer}
        gig={selectedGig}
        onClose={() => {
          setSelectedGig(null);
          setIsOfferModalOpen(false);
        }}
      />
    </div>
  );
}
