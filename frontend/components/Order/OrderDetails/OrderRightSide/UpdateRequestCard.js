"use client";
// "Ask for an update": the buyer nudges the seller on an in-progress order;
// the seller answers with a short progress note. One open at a time.
import { useState } from "react";
import moment from "moment";
import { toast } from "sonner";
import { useAskOrderUpdateMutation, useAnswerOrderUpdateMutation } from "@/app/redux/features/order/buyerOrderApi";

export default function UpdateRequestCard({ order, orderId, isSeller }) {
  const [ask, { isLoading: asking }] = useAskOrderUpdateMutation();
  const [answer, { isLoading: answering }] = useAnswerOrderUpdateMutation();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const ur = order?.updateRequest || {};
  const pending = ur.status === "pending";
  if (!["active", "late"].includes(order?.status) || order?.delivery?.state === "submitted") return null;
  if (isSeller && !pending) return null;

  const fail = (r, m) => toast.error(r.error?.data?.message || m);
  const onAsk = async () => {
    const r = await ask({ orderId, note: text });
    if (r.error) return fail(r, "Could not send");
    toast.success("Update requested");
    setOpen(false);
    setText("");
  };
  const onAnswer = async () => {
    const r = await answer({ orderId, reply: text });
    if (r.error) return fail(r, "Could not send");
    toast.success("Update sent");
    setText("");
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3" aria-labelledby="upd-h">
      <h3 id="upd-h" className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Progress update</h3>
      {isSeller ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
            The buyer asked for an update {moment(ur.requestedAt).fromNow()}.{ur.note ? <> &ldquo;{ur.note}&rdquo;</> : null}
          </p>
          <label htmlFor="upd-reply" className="sr-only">Your update</label>
          <textarea id="upd-reply" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Where things stand and when you expect to deliver" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          <button type="button" disabled={answering || text.trim().length < 5} onClick={onAnswer} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">Send update</button>
        </div>
      ) : pending ? (
        <p className="text-sm text-gray-600">You asked for an update {moment(ur.requestedAt).fromNow()}. The seller has been notified.</p>
      ) : (
        <>
          {ur.status === "answered" ? (
            <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">Seller update, {moment(ur.answeredAt).fromNow()}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{ur.reply}</p>
            </div>
          ) : null}
          {open ? (
            <div className="space-y-2">
              <label htmlFor="upd-note" className="text-sm text-gray-700">Anything specific? (optional)</label>
              <textarea id="upd-note" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
              <div className="flex gap-2">
                <button type="button" disabled={asking} onClick={onAsk} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">Send</button>
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm">Back</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Ask for an update</button>
          )}
        </>
      )}
    </section>
  );
}
