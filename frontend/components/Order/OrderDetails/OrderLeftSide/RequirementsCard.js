"use client";
// Buyer requirements for an order (Fiverr-style). When the gig defines
// questions and the buyer has not answered yet, the buyer sees a form;
// the seller sees a waiting notice. Once submitted both see the answers.
// Also shows the escrow / auto-complete status line.

import { useState } from "react";
import moment from "moment";
import { toast } from "sonner";
import { IoLockClosedOutline, IoDocumentTextOutline } from "react-icons/io5";
import { useSubmitOrderRequirementsMutation } from "@/app/redux/features/order/buyerOrderApi";

export default function RequirementsCard({ order, orderId, isSeller }) {
  const questions = order?.data?.requirementQuestions || [];
  const answers = order?.data?.requirementAnswers || [];
  const status = order?.requirementsStatus;
  const [values, setValues] = useState(() => questions.map(() => ""));
  const [submit, { isLoading }] = useSubmitOrderRequirementsMutation();

  const escrow = order?.escrow;
  const autoCompleteAt = order?.delivery?.state === "submitted" ? order?.delivery?.autoCompleteAt : null;

  async function onSubmit(e) {
    e.preventDefault();
    const payload = questions.map((q, i) => ({ question: q.question, answer: values[i] || "" }));
    const res = await submit({ orderId, answers: payload });
    if (res.error) toast.error(res.error?.data?.message || "Could not submit requirements");
    else toast.success("Requirements sent. The seller's delivery clock has started.");
  }

  return (
    <>
      {escrow?.status && (
        <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <IoLockClosedOutline className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            {escrow.status === "held" &&
              `$${Number(escrow.amount || 0).toFixed(2)} is held securely and released to the seller when the order is completed.`}
            {escrow.status === "released" && "Payment released to the seller."}
            {escrow.status === "refunded" && "Payment refunded to the buyer."}
            {autoCompleteAt &&
              ` If the buyer does not respond, the order completes automatically on ${moment(autoCompleteAt).format("D MMM YYYY, HH:mm")}.`}
          </span>
        </div>
      )}

      {status === "pending" && !isSeller && questions.length > 0 && (
        <form onSubmit={onSubmit} className="bg-white border border-amber-200 rounded-2xl p-5 md:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Submit your requirements</h3>
            <p className="text-xs text-gray-500 mt-1">The seller starts working, and the delivery clock starts, once you answer these.</p>
          </div>
          {questions.map((q, i) => (
            <label key={i} className="block">
              <span className="text-sm font-medium text-gray-800">
                {q.question}
                {q.required && <span className="text-rose-500"> *</span>}
              </span>
              <textarea
                value={values[i]}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                required={!!q.required}
                rows={3}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isLoading ? "Sending..." : "Start order"}
          </button>
        </form>
      )}

      {status === "pending" && isSeller && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          Waiting for the buyer to submit requirements. The delivery clock starts when they do.
        </div>
      )}

      {status === "submitted" && answers.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide inline-flex items-center gap-2">
            <IoDocumentTextOutline /> Requirements
          </h3>
          <dl className="mt-3 space-y-3">
            {answers.map((a, i) => (
              <div key={i}>
                <dt className="text-xs font-semibold text-gray-500">{a.question}</dt>
                <dd className="text-sm text-gray-800 whitespace-pre-line">{a.answer || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
