"use client";
// Mutual cancellation on the order page. Either side asks with a reason;
// the other side accepts or declines; the asker can withdraw. A buyer can
// cancel a late order straight away, and a seller can always cancel.
import { useState } from "react";
import moment from "moment";
import { toast } from "sonner";
import {
  useRequestCancellationMutation,
  useRespondCancellationMutation,
  useUpdateBuyerOrderStatusMutation,
} from "@/app/redux/features/order/buyerOrderApi";

export default function CancellationCard({ order, orderId, isSeller }) {
  const [ask, { isLoading: asking }] = useRequestCancellationMutation();
  const [respond, { isLoading: responding }] = useRespondCancellationMutation();
  const [updateOrder] = useUpdateBuyerOrderStatusMutation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cr = order?.cancellationRequest || {};
  const me = isSeller ? "seller" : "buyer";
  const pending = cr.status === "pending";
  const mine = pending && cr.byRole === me;
  const canCancelNow = isSeller || order?.status === "late";

  const err = (r, fallback) => toast.error(r.error?.data?.message || fallback);
  const submit = async () => {
    const r = await ask({ orderId, reason });
    if (r.error) return err(r, "Could not send the request");
    toast.success("Cancellation request sent");
    setOpen(false);
    setReason("");
  };
  const answer = async (action) => {
    const r = await respond({ orderId, action });
    if (r.error) return err(r, "Could not update the request");
    toast.success(action === "accept" ? "Order cancelled and refunded" : action === "decline" ? "Request declined" : "Request withdrawn");
  };
  const cancelNow = async () => {
    if (!confirm(isSeller ? "Cancel this order? The buyer is refunded in full and it counts against your cancellation rate." : "Cancel this late order? You are refunded in full.")) return;
    const r = await updateOrder({ orderId, status: "cancelled", reason: isSeller ? "Cancelled by the seller" : "Late order cancelled by the buyer" });
    if (r.error) return err(r, "Could not cancel");
    toast.success("Order cancelled");
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3" aria-labelledby="cancel-h">
      <h3 id="cancel-h" className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cancellation</h3>
      {pending ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <p className="font-medium">{mine ? "You asked to cancel this order." : `The ${cr.byRole} asked to cancel this order.`}</p>
          <p className="mt-1">&ldquo;{cr.reason}&rdquo;</p>
          <p className="mt-1 text-xs">{mine ? "If they don't answer" : "If you don't answer"} by {moment(cr.respondBy).format("D MMM, HH:mm")}, the order is cancelled automatically.</p>
          <div className="mt-3 flex gap-2">
            {mine ? (
              <button type="button" disabled={responding} onClick={() => answer("withdraw")} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm">Withdraw request</button>
            ) : (
              <>
                <button type="button" disabled={responding} onClick={() => answer("accept")} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm">Accept and cancel</button>
                <button type="button" disabled={responding} onClick={() => answer("decline")} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm">Decline</button>
              </>
            )}
          </div>
        </div>
      ) : open ? (
        <div className="space-y-2">
          <label htmlFor="cancel-reason" className="text-sm text-gray-700">Why do you want to cancel?</label>
          <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={asking || reason.trim().length < 5} onClick={submit} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm disabled:opacity-50">Send request</button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm">Back</button>
          </div>
        </div>
      ) : (
        <>
          {["declined", "withdrawn"].includes(cr.status) ? <p className="text-xs text-gray-500">Last request was {cr.status}.</p> : null}
          <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50">
            Request cancellation
          </button>
          {canCancelNow ? (
            <button type="button" onClick={cancelNow} className="w-full px-4 py-2 rounded-lg text-rose-700 text-xs hover:underline">
              {isSeller ? "Cancel the order myself" : "Order is late: cancel now"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
