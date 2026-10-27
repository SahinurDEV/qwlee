"use client";
// Ask the policy-grounded AI assistant on /support (375px-friendly).

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IoSparklesOutline, IoWarningOutline } from "react-icons/io5";
import {
  useAskSupportAiMutation,
  useGetSupportAiStatusQuery,
} from "@/app/redux/features/supportApi";

export default function AskSupportAi() {
  const { data: status } = useGetSupportAiStatusQuery();
  const [ask, { isLoading }] = useAskSupportAiMutation();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);

  async function handleAsk(e) {
    e.preventDefault();
    if (question.trim().length < 5) {
      toast.warning("Type a bit more so we can search the policies.");
      return;
    }
    const res = await ask({ question: question.trim() });
    if (res?.error) {
      toast.error(res.error?.data?.message || "AI support is unavailable right now");
      return;
    }
    const attrs = res?.data;
    setResult(attrs);
    if (attrs?.escalate && attrs?.ticketId) {
      toast.message("Opened a ticket for a human admin.");
    }
  }

  return (
    <section className="bg-violet-50/60 border border-violet-200 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-900 flex items-center gap-1.5">
          <IoSparklesOutline /> Ask AI (policies)
        </h2>
        <span className="text-[11px] text-ink-500 text-gray-500">
          {status?.configured ? "Ready" : "Mock / offline OK"}
        </span>
      </div>
      <p className="text-xs text-gray-600">
        Answers cite published qwlee policies. Low confidence escalates to a human ticket — the AI never bans or refunds anyone.
      </p>
      <form onSubmit={handleAsk} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="e.g. How do refunds work if a seller is late?"
          className="w-full text-sm border border-violet-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {isLoading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {result ? (
        <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-900">
              {(Number(result.confidence) * 100).toFixed(0)}% confidence
            </span>
            {result.source ? <span>· {result.source}</span> : null}
            {result.escalate ? (
              <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <IoWarningOutline /> Escalated to human
              </span>
            ) : null}
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.answer}</p>
          {(result.citations || []).length ? (
            <ul className="space-y-1.5">
              {result.citations.map((c, i) => (
                <li key={i} className="text-xs border border-gray-100 rounded-lg px-2.5 py-2 bg-gray-50">
                  <div className="font-semibold text-gray-700 break-all">{c.source}</div>
                  <div className="text-gray-600 mt-0.5">“{c.quote}”</div>
                  {c.why ? <div className="text-gray-400 mt-0.5">{c.why}</div> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {result.ticketId ? (
            <Link
              href={`/support/${result.ticketId}`}
              className="inline-block text-sm text-emerald-700 font-medium underline"
            >
              Open your ticket
            </Link>
          ) : (
            <button
              type="button"
              className="text-sm text-violet-800 underline"
              onClick={async () => {
                const res = await ask({ question: question.trim(), escalate: true });
                const attrs = res?.data;
                if (attrs?.ticketId) {
                  setResult(attrs);
                  toast.success("Ticket opened");
                } else if (res?.error) {
                  toast.error(res.error?.data?.message || "Could not open ticket");
                }
              }}
            >
              Talk to a human instead
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
