"use client";
// /support — user-facing ticket inbox.
//
// Shows the list of the user's own tickets, a "New ticket" form, and
// links into the thread detail. Banned users are blocked by middleware
// anyway so we don't need a separate check here.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IoChevronForward, IoAlertCircleOutline } from "react-icons/io5";

import {
  useGetMyTicketsQuery,
  useCreateTicketMutation,
} from "@/app/redux/features/supportApi";
import useUser from "@/hooks/useUser";

const STATUS_TONE = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  resolved: "bg-sky-50 text-sky-700 border-sky-100",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

const CATEGORIES = [
  { v: "billing", label: "Billing & payments" },
  { v: "orders", label: "Orders & delivery" },
  { v: "account", label: "Account access" },
  { v: "trust-safety", label: "Trust & safety" },
  { v: "other", label: "Something else" },
];

export default function SupportInbox() {
  const user = useUser();
  const { data, isFetching } = useGetMyTicketsQuery({}, { skip: !user });
  const [createTicket, { isLoading: creating }] = useCreateTicketMutation();
  const tickets = data?.results || [];

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [body, setBody] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.warning("Add a subject and a message before submitting.");
      return;
    }
    const res = await createTicket({ subject, category, body });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not create the ticket");
      return;
    }
    toast.success("Ticket sent — our team will reply soon.");
    setSubject("");
    setCategory("other");
    setBody("");
  }

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-center text-gray-600">
          Please <Link href="/sign-in?from=/support" className="text-emerald-700 font-medium">sign in</Link>{" "}
          to open a support ticket.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 md:py-10 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Help & support
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Reach our team for anything billing, account, orders, or trust & safety related.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                Your tickets
              </h2>
              <span className="text-xs text-gray-500">
                {tickets.length} total
              </span>
            </header>
            {isFetching && tickets.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-500">Loading…</div>
            ) : tickets.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <IoAlertCircleOutline className="w-7 h-7 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  No tickets yet. Use the form to start one.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tickets.map((t) => {
                  const tone = STATUS_TONE[t.status] || STATUS_TONE.open;
                  return (
                    <li key={t._id || t.id}>
                      <Link
                        href={`/support/${t._id || t.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {t.subject}
                            </span>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${tone}`}
                            >
                              {t.status}
                            </span>
                            {t.unreadByUser > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full px-1.5">
                                {t.unreadByUser} new
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {t.category}
                            {" · "}
                            Last update {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : "—"}
                          </div>
                        </div>
                        <IoChevronForward className="text-gray-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 sticky top-20">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              Open a new ticket
            </h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Tell us what&rsquo;s going on. We typically respond within a few hours.
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  required
                  placeholder="Short summary of the issue"
                  aria-label="Subject"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500 bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                  rows={6}
                  required
                  aria-label="Describe the issue"
                  placeholder="Be as specific as possible: order ids, dates, anything you've tried…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500 resize-none"
                />
                <div className="text-[11px] text-gray-400 mt-1 text-right">
                  {body.length}/4000
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? "Sending…" : "Submit ticket"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
