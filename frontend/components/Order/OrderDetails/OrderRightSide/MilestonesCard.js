"use client";
// Milestone payment plan on a custom-offer order. The buyer releases each
// milestone's share of escrow as the work arrives; releasing the last one
// completes the order.
import { toast } from "sonner";
import { IoFlagOutline, IoCheckmarkCircle } from "react-icons/io5";
import { useReleaseMilestoneMutation } from "@/app/redux/features/order/buyerOrderApi";

export default function MilestonesCard({ order, orderId, isSeller }) {
  const list = order?.data?.milestones || [];
  const [release, { isLoading }] = useReleaseMilestoneMutation();
  if (!list.length) return null;
  const open = order?.status === "active" || order?.status === "late";
  const paid = list.filter((m) => m.status === "released").reduce((n, m) => n + Number(m.amount || 0), 0);
  const total = list.reduce((n, m) => n + Number(m.amount || 0), 0);
  const pendingLeft = list.filter((m) => m.status === "pending").length;

  async function onRelease(i, m) {
    const last = pendingLeft === 1;
    const msg = last
      ? `Release the last milestone "${m.title}" ($${m.amount})? This completes the order and pays the seller.`
      : `Release $${m.amount} for "${m.title}" to the seller?`;
    if (!window.confirm(msg)) return;
    const res = await release({ orderId, index: i });
    if (res.error) return toast.error(res.error?.data?.message || "Could not release the milestone");
    toast.success(last ? "Order completed" : "Milestone released");
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <IoFlagOutline className="text-emerald-600" /> Milestones
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        ${paid.toFixed(2)} of ${total.toFixed(2)} released{order?.status === "cancelled" && paid < total ? `; $${(total - paid).toFixed(2)} refunded` : ""}.
      </p>
      <ol className="mt-3 space-y-2">
        {list.map((m, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${m.status === "released" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {m.status === "released" ? <IoCheckmarkCircle /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">{m.title}</div>
              <div className="text-xs text-gray-500">${Number(m.amount).toFixed(2)} · {m.days} day{m.days === 1 ? "" : "s"}{m.status === "released" ? " · released" : ""}</div>
            </div>
            {!isSeller && open && m.status === "pending" && (
              <button type="button" disabled={isLoading} onClick={() => onRelease(i, m)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                Release
              </button>
            )}
          </li>
        ))}
      </ol>
      {isSeller && open && <p className="mt-3 text-xs text-gray-500">The buyer releases each milestone as you deliver it.</p>}
    </section>
  );
}
