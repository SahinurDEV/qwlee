"use client";
// /subscriptions: a buyer's monthly gig subscriptions, and for sellers the
// subscriptions to their gigs plus the per-gig opt-in.
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useUser from "@/hooks/useUser";
import { useGetMyGigsStatsQuery } from "@/app/redux/features/sellerLevelApi";
import { useGetSubscriptionsQuery, useUpdateSubscriptionMutation, useSetGigSubscriptionMutation } from "@/app/redux/features/subscriptionsApi";

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
const BADGE = { active: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", cancelled: "bg-gray-100 text-gray-600" };

function SubList({ role }) {
  const { data = [], isLoading } = useGetSubscriptionsQuery(role);
  const [update] = useUpdateSubscriptionMutation();
  async function act(s, action) {
    if (action === "cancel" && !window.confirm("Cancel this subscription? Open orders are not affected.")) return;
    const r = await update({ id: s.id, action });
    if (r.error) toast.error(r.error?.data?.message || "Could not update");
    else toast.success(`Subscription ${r.data?.data?.attributes?.status}`);
  }
  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!data.length) return <p className="text-sm text-gray-500">{role === "seller" ? "No one subscribes to your gigs yet." : "You have no subscriptions. Look for “Subscribe monthly” on a gig."}</p>;
  return (
    <ul className="space-y-3">
      {data.map((s) => {
        const who = role === "seller" ? s.buyer : s.seller;
        const last = [...s.cycles].reverse().find((c) => c.orderId);
        return (
          <li key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/gig/${s.gig.slug || s.gig.id}`} className="font-medium text-gray-900 hover:text-emerald-700">{s.gig.title || "Gig"}</Link>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.packageName} · ${s.price}/month{s.discountPercent ? ` (${s.discountPercent}% off)` : ""} · {role === "seller" ? "Buyer" : "Seller"}: {who?.fullName || who?.username || "-"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.status === "active" ? `Next order ${fmt(s.nextBillingAt)}` : s.status === "paused" ? "Paused: no new orders" : "Cancelled"} · {(() => { const n = s.cycles.filter((c) => c.status === "paid").length; return `${n} order${n === 1 ? "" : "s"} so far`; })()}
                  {last ? <> · <Link href={`/order/${last.orderId}`} className="text-emerald-700 hover:underline">latest order</Link></> : null}
                </div>
                {s.cycles.some((c) => c.status === "failed") && (
                  <div className="text-xs text-rose-700 mt-1">Last failed: {[...s.cycles].reverse().find((c) => c.status === "failed")?.error}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[s.status]}`}>{s.status}</span>
                {role === "buyer" && s.status === "active" && <button onClick={() => act(s, "pause")} className="text-xs text-gray-700 hover:underline">Pause</button>}
                {role === "buyer" && s.status === "paused" && <button onClick={() => act(s, "resume")} className="text-xs text-emerald-700 hover:underline">Resume</button>}
                {s.status !== "cancelled" && <button onClick={() => act(s, "cancel")} className="text-xs text-rose-700 hover:underline">Cancel</button>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function GigOptions() {
  const { data } = useGetMyGigsStatsQuery();
  const [save] = useSetGigSubscriptionMutation();
  const [draft, setDraft] = useState({});
  const gigs = (data?.gigs || []).filter((g) => g.status === "active");
  if (!gigs.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900">Offer subscriptions on your gigs</h2>
      <p className="text-sm text-gray-600">Buyers can then order the same package every month, at an optional discount of up to 30%.</p>
      <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
        {gigs.map((g) => {
          const cur = draft[g._id] ?? { enabled: !!g.subscription?.enabled, discountPercent: g.subscription?.discountPercent || 0 };
          return (
            <li key={g._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{g.title}</span>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={cur.enabled} onChange={(e) => setDraft({ ...draft, [g._id]: { ...cur, enabled: e.target.checked } })} /> Monthly
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                Discount
                <input type="number" min={0} max={30} value={cur.discountPercent} onChange={(e) => setDraft({ ...draft, [g._id]: { ...cur, discountPercent: e.target.value } })} className="w-16 rounded border border-gray-300 px-2 py-1" aria-label={`Discount for ${g.title}`} />%
              </label>
              <button
                onClick={async () => {
                  const r = await save({ gigId: g._id, enabled: cur.enabled, discountPercent: Number(cur.discountPercent) });
                  if (r.error) toast.error(r.error?.data?.message || "Could not save");
                  else toast.success("Saved");
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Save
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Subscriptions() {
  const user = useUser();
  const isSeller = user?.role === "freelancer";
  // The user loads after the first render, so the default tab is derived.
  const [picked, setTab] = useState(null);
  const tab = picked || (isSeller ? "seller" : "buyer");
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
      <p className="mt-1 text-sm text-gray-600">A subscription places the same order every month. Each month is a normal order with escrow, delivery and payout.</p>
      {isSeller && (
        <div className="mt-5 flex gap-2" role="tablist">
          {[["seller", "Subscribers to my gigs"], ["buyer", "My subscriptions"]].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 text-sm ${tab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>
          ))}
        </div>
      )}
      <div className="mt-5"><SubList role={isSeller ? tab : "buyer"} /></div>
      {isSeller && tab === "seller" && <GigOptions />}
    </main>
  );
}
