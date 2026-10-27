"use client";
// Milestone payment plan on a custom-offer order. Visual timeline shows
// progress, due windows, and release dates; the buyer releases each
// milestone's share of escrow as the work arrives.
import { toast } from "sonner";
import { IoFlagOutline, IoCheckmarkCircle, IoTimeOutline } from "react-icons/io5";
import { useReleaseMilestoneMutation } from "@/app/redux/features/order/buyerOrderApi";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";

function dueDates(list, orderStart) {
  // Cumulative delivery windows from order start (or now if unknown).
  const start = orderStart ? new Date(orderStart).getTime() : Date.now();
  let acc = 0;
  return list.map((m) => {
    acc += Number(m.days) || 0;
    return new Date(start + acc * 86400000);
  });
}

export default function MilestonesCard({ order, orderId, isSeller }) {
  const list = order?.data?.milestones || [];
  const [release, { isLoading }] = useReleaseMilestoneMutation();
  if (!list.length) return null;
  const open = order?.status === "active" || order?.status === "late";
  const paid = list.filter((m) => m.status === "released").reduce((n, m) => n + Number(m.amount || 0), 0);
  const total = list.reduce((n, m) => n + Number(m.amount || 0), 0);
  const pendingLeft = list.filter((m) => m.status === "pending").length;
  const releasedCount = list.filter((m) => m.status === "released").length;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const dues = dueDates(list, order?.createdAt || order?.data?.startedAt);
  const nextIdx = list.findIndex((m) => m.status === "pending");

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
    <section className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="milestones-timeline">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <IoFlagOutline className="text-emerald-600" /> Milestone timeline
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        ${paid.toFixed(2)} of ${total.toFixed(2)} released
        {order?.status === "cancelled" && paid < total ? `; $${(total - paid).toFixed(2)} refunded` : ""}
        {" · "}
        {releasedCount}/{list.length} done
      </p>

      <div className="mt-3" aria-hidden>
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-gray-500 mb-1">
          <span>Progress</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 relative space-y-0">
        {/* Vertical connector */}
        <span
          aria-hidden
          className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gray-200"
        />
        {list.map((m, i) => {
          const done = m.status === "released";
          const current = i === nextIdx && open;
          return (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white ${
                  done
                    ? "bg-emerald-500 text-white"
                    : current
                      ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-500"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {done ? <IoCheckmarkCircle className="w-4 h-4" /> : i + 1}
              </span>
              <div className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 ${current ? "border-emerald-300 bg-emerald-50/40" : "border-gray-100 bg-white"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="tabular-nums">${Number(m.amount).toFixed(2)}</span>
                      <span>·</span>
                      <span>{m.days} day{m.days === 1 ? "" : "s"}</span>
                      {done && m.releasedAt ? (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <IoCheckmarkCircle className="w-3 h-3" /> Released {fmt(m.releasedAt)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <IoTimeOutline className="w-3 h-3" /> Due {fmt(dues[i])}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {!isSeller && open && m.status === "pending" && i === nextIdx && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onRelease(i, m)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Release
                    </button>
                  )}
                  {done && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Released
                    </span>
                  )}
                  {current && !done && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Current
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {isSeller && open && (
        <p className="mt-3 text-xs text-gray-500">The buyer releases each milestone in order as you deliver it.</p>
      )}
      {!isSeller && open && nextIdx >= 0 && (
        <p className="mt-3 text-xs text-gray-500">Release milestones in order — only the current one can be released.</p>
      )}
    </section>
  );
}
