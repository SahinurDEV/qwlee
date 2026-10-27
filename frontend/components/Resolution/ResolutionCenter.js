"use client";
// /resolution: self-serve Resolution Center — open disputes, cancellation
// and extension requests across your buyer and seller orders.
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useUser from "@/hooks/useUser";
import { useGetBuyerAllOrderQuery, useRespondCancellationMutation, useRespondOrderExtensionMutation } from "@/app/redux/features/order/buyerOrderApi";
import { useGetFreelancerAllOrderQuery } from "@/app/redux/features/order/freelancerOrderApi";
import {
  useGetMyDisputesQuery,
  useRespondToDisputeMutation,
  useEscalateDisputeMutation,
  useCancelDisputeMutation,
} from "@/app/redux/features/order/disputeApi";
import { IoShieldCheckmarkOutline, IoFlagOutline, IoTimeOutline, IoCloseCircleOutline } from "react-icons/io5";

const idOf = (v) => String(v?.id || v?._id || v || "");
const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ResolutionCenter() {
  const user = useUser();
  const uid = idOf(user);
  const skip = !user;
  const { data: buyerData, isLoading: bLoad } = useGetBuyerAllOrderQuery({ limit: 100 }, { skip });
  const { data: sellerData, isLoading: sLoad } = useGetFreelancerAllOrderQuery({ limit: 100 }, { skip });
  const { data: disputesData, isLoading: dLoad } = useGetMyDisputesQuery({ limit: 50 }, { skip });
  const [respondCancel] = useRespondCancellationMutation();
  const [respondExt] = useRespondOrderExtensionMutation();
  const [respondDispute] = useRespondToDisputeMutation();
  const [escalate] = useEscalateDisputeMutation();
  const [cancelDispute] = useCancelDisputeMutation();
  const [reply, setReply] = useState({});

  const buyerOrders = buyerData?.results || [];
  const sellerOrders = sellerData?.results || [];
  const allOrders = useMemo(() => {
    const map = new Map();
    [...buyerOrders, ...sellerOrders].forEach((o) => map.set(idOf(o), o));
    return [...map.values()];
  }, [buyerOrders, sellerOrders]);

  const cancels = allOrders.filter((o) => o.cancellationRequest?.status === "pending");
  const extensions = allOrders.filter((o) => o.extensionRequest?.status === "pending");
  const disputedOrders = allOrders.filter((o) => o.status === "disputed");
  const disputes = disputesData?.results || disputesData?.docs || [];
  const openDisputes = (Array.isArray(disputes) ? disputes : []).filter(
    (d) => !["resolved", "cancelled"].includes(d.status)
  );

  const loading = bLoad || sLoad || dLoad;

  async function onCancelRespond(orderId, action) {
    const r = await respondCancel({ orderId, action });
    if (r.error) toast.error(r.error?.data?.message || "Could not respond");
    else toast.success(action === "accept" ? "Order cancelled" : "Cancellation declined");
  }
  async function onExtRespond(orderId, action) {
    const r = await respondExt({ orderId, action });
    if (r.error) toast.error(r.error?.data?.message || "Could not respond");
    else toast.success(action === "accept" ? "Extension accepted" : "Extension declined");
  }
  async function onDisputeReply(disputeId) {
    const message = (reply[disputeId] || "").trim();
    if (message.length < 5) return toast.warning("Write a short reply (5+ characters)");
    const r = await respondDispute({ disputeId, message });
    if (r.error) toast.error(r.error?.data?.message || "Could not reply");
    else {
      toast.success("Reply sent");
      setReply((x) => ({ ...x, [disputeId]: "" }));
    }
  }

  if (!user) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-semibold">Resolution Center</h1>
        <p className="mt-2 text-gray-600">
          <Link href="/sign-in" className="text-emerald-700">Sign in</Link> to manage cancellations, extensions and disputes.
        </p>
      </div>
    );
  }

  const empty = !loading && !cancels.length && !extensions.length && !openDisputes.length && !disputedOrders.length;

  return (
    <main className="container mx-auto px-4 py-10 max-w-4xl" data-testid="resolution-center">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          <IoShieldCheckmarkOutline /> Self-serve
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Resolution Center</h1>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Handle cancellation requests, delivery extensions and disputes without waiting on support. Open an order for full chat and delivery tools.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/order" className="text-emerald-700 font-medium hover:underline">All orders →</Link>
          <Link href="/help/how-do-i-cancel-an-order" className="text-gray-600 hover:underline">Cancel help</Link>
          <Link href="/learn" className="text-gray-600 hover:underline">Learn</Link>
        </div>
      </header>

      {loading ? <p className="text-sm text-gray-500">Loading open items…</p> : null}

      {empty ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center" data-testid="resolution-empty">
          <p className="font-medium text-gray-900">Nothing needs attention</p>
          <p className="mt-1 text-sm text-gray-600">When someone asks to cancel, extend delivery, or opens a dispute, it shows up here.</p>
        </div>
      ) : null}

      {cancels.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><IoCloseCircleOutline className="text-rose-600" /> Cancellation requests</h2>
          {cancels.map((o) => {
            const cr = o.cancellationRequest;
            const oid = idOf(o);
            const mine = String(cr.by) === uid || String(cr.by?._id) === uid;
            return (
              <div key={oid} className="rounded-2xl border border-rose-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/order/${oid}`} className="font-medium text-emerald-700 hover:underline">{o.data?.title || o.items?.[0]?.title || `Order ${oid.slice(-6)}`}</Link>
                    <p className="text-xs text-gray-500 mt-0.5">{cr.byRole} asked · respond by {fmt(cr.respondBy)}</p>
                    <p className="text-sm text-gray-700 mt-2">{cr.reason}</p>
                  </div>
                  {!mine && (
                    <div className="flex gap-2">
                      <button onClick={() => onCancelRespond(oid, "accept")} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Accept cancel</button>
                      <button onClick={() => onCancelRespond(oid, "decline")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Decline</button>
                    </div>
                  )}
                  {mine && <span className="text-xs text-gray-500">Waiting on the other party</span>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {extensions.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><IoTimeOutline className="text-amber-600" /> Extension requests</h2>
          {extensions.map((o) => {
            const er = o.extensionRequest;
            const oid = idOf(o);
            const mine = String(er.by) === uid || String(er.by?._id) === uid;
            return (
              <div key={oid} className="rounded-2xl border border-amber-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/order/${oid}`} className="font-medium text-emerald-700 hover:underline">{o.data?.title || `Order ${oid.slice(-6)}`}</Link>
                    <p className="text-xs text-gray-500 mt-0.5">New date {fmt(er.newDate || er.proposedDate)} · {er.reason}</p>
                  </div>
                  {!mine && (
                    <div className="flex gap-2">
                      <button onClick={() => onExtRespond(oid, "accept")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Accept</button>
                      <button onClick={() => onExtRespond(oid, "decline")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Decline</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {(openDisputes.length > 0 || disputedOrders.length > 0) && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><IoFlagOutline className="text-rose-600" /> Disputes</h2>
          {openDisputes.length === 0 && disputedOrders.map((o) => (
            <div key={idOf(o)} className="rounded-2xl border border-rose-100 bg-white p-4">
              <Link href={`/order/${idOf(o)}`} className="font-medium text-emerald-700 hover:underline">{o.data?.title || "Disputed order"}</Link>
              <p className="text-xs text-gray-500 mt-1">Order is paused — open it to continue the conversation.</p>
            </div>
          ))}
          {openDisputes.map((d) => {
            const did = idOf(d);
            const oid = idOf(d.orderId);
            return (
              <div key={did} className="rounded-2xl border border-rose-100 bg-white p-4 space-y-3" data-testid="dispute-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{String(d.reasonCode || "dispute").replace(/_/g, " ")}</div>
                    <p className="text-xs text-gray-500 mt-0.5">Status: {d.status} · opened {fmt(d.createdAt)}</p>
                    {oid && oid !== "undefined" && (
                      <Link href={`/order/${oid}`} className="text-sm text-emerald-700 hover:underline">View order →</Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        const r = await escalate(did);
                        if (r.error) toast.error(r.error?.data?.message || "Could not escalate");
                        else toast.success("Escalated to support");
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Cancel this dispute and resume the order?")) return;
                        const r = await cancelDispute(did);
                        if (r.error) toast.error(r.error?.data?.message || "Could not cancel");
                        else toast.success("Dispute cancelled");
                      }}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Cancel dispute
                    </button>
                  </div>
                </div>
                {d.description ? <p className="text-sm text-gray-700">{d.description}</p> : null}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Reply to the other party…"
                    value={reply[did] || ""}
                    onChange={(e) => setReply((x) => ({ ...x, [did]: e.target.value }))}
                  />
                  <button onClick={() => onDisputeReply(did)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                    Send reply
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <h2 className="font-semibold text-gray-900">How resolution works</h2>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Try to agree in order chat first (cancel request or extension).</li>
          <li>If you still disagree, open a dispute from the order — the clock pauses.</li>
          <li>Reply here or on the order. Escalate only if you need a Qwlee review.</li>
        </ol>
      </section>
    </main>
  );
}
