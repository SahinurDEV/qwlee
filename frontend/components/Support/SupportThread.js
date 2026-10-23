"use client";
// /support/[ticketId] — user-facing thread view + reply composer.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IoArrowBack, IoSend } from "react-icons/io5";

import useUser from "@/hooks/useUser";
import {
  useGetTicketQuery,
  usePostTicketMessageMutation,
} from "@/app/redux/features/supportApi";
import Avatar from "@/components/common/Avatar";

const STATUS_TONE = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  resolved: "bg-sky-50 text-sky-700 border-sky-100",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function SupportThread() {
  const user = useUser();
  const router = useRouter();
  const { ticketId } = useParams();
  const { data, isFetching, isError } = useGetTicketQuery(ticketId, {
    skip: !user || !ticketId,
  });
  const [postMessage, { isLoading: sending }] = usePostTicketMessageMutation();
  const [body, setBody] = useState("");
  const bottomRef = useRef(null);

  const ticket = data?.ticket;
  const messages = data?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-center text-gray-600">
          Please <Link href={`/sign-in?from=/support/${ticketId}`} className="text-emerald-700 font-medium">sign in</Link>{" "}
          to view this ticket.
        </p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="container mx-auto px-4 py-12 max-w-3xl text-center">
        <h1 className="text-xl font-semibold text-gray-900">Ticket not found</h1>
        <Link href="/support" className="text-emerald-700 mt-2 inline-block">
          ← Back to support
        </Link>
      </main>
    );
  }

  const tone = STATUS_TONE[ticket?.status] || STATUS_TONE.open;
  const myId = String(user?.id || user?._id || "");

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    const res = await postMessage({ ticketId, body: body.trim() });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't send your reply");
      return;
    }
    setBody("");
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href="/support"
        className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-3"
      >
        <IoArrowBack /> Back to support
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-900">
                {ticket?.subject || (isFetching ? "Loading…" : "Ticket")}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Opened {ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : "—"}
                {ticket?.category ? ` · ${ticket.category}` : ""}
              </p>
            </div>
            {ticket?.status && (
              <span className={`text-xs font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${tone}`}>
                {ticket.status}
              </span>
            )}
          </div>
        </header>

        <div className="bg-gray-50/60 px-3 md:px-5 py-5 max-h-[60vh] overflow-y-auto space-y-3">
          {messages.length === 0 && !isFetching ? (
            <p className="text-sm text-gray-500 text-center py-4">No messages yet.</p>
          ) : (
            messages.map((m) => {
              const mine = String(m.senderId?._id || m.senderId?.id || m.senderId) === myId;
              return (
                <div key={m._id || m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                  <Avatar
                    src={m.senderId?.image}
                    name={m.senderRole === "admin" ? "Qwlee Support" : m.senderId?.fullName}
                    size={32}
                    rounded
                  />
                  <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`flex items-center gap-2 text-xs text-gray-500 mb-1 ${mine ? "flex-row-reverse" : ""}`}>
                      <span className="font-medium text-gray-800">
                        {mine ? "You" : m.senderRole === "admin" ? "Qwlee Support" : (m.senderId?.fullName || "Member")}
                      </span>
                      <span>·</span>
                      <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
                    </div>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                        mine
                          ? "bg-emerald-600 text-white rounded-tr-sm"
                          : "bg-white text-gray-900 border border-gray-200 rounded-tl-sm"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {ticket?.status === "closed" ? (
          <div className="px-5 py-4 bg-gray-50 text-center text-sm text-gray-600 border-t border-gray-100">
            This ticket is closed. Open a new one if you need more help.
          </div>
        ) : (
          <form onSubmit={handleSend} className="border-t border-gray-100 p-3 md:p-4 bg-white">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Type a reply…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500 resize-none"
            />
            <div className="flex items-center justify-end mt-2">
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <IoSend />
                {sending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
