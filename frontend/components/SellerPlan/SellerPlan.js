"use client";
// /seller-plan: Seller Plus / Premium, paid monthly from the seller balance.
import { toast } from "sonner";
import { IoCheckmarkCircle } from "react-icons/io5";
import { useGetSellerPlanQuery, useSubscribeSellerPlanMutation, useCancelSellerPlanMutation } from "@/app/redux/features/sellerPlanApi";

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const err = (r, f) => r?.error?.data?.message || f;

export default function SellerPlan() {
  const { data, isLoading } = useGetSellerPlanQuery();
  const [subscribe, { isLoading: saving }] = useSubscribeSellerPlanMutation();
  const [cancel] = useCancelSellerPlanMutation();
  if (isLoading) return <div className="container py-16 text-gray-500">Loading…</div>;
  if (!data) return <div className="container py-16 text-gray-500">Sign in as a seller to see plans.</div>;
  const cur = data.current;
  async function pick(tier) {
    const r = await subscribe(tier);
    if (r.error) return toast.error(err(r, "Could not change plan"));
    toast.success("Plan updated");
  }
  async function stop() {
    const r = await cancel();
    if (r.error) return toast.error(err(r, "Could not cancel"));
    toast.success("Your plan will end at the end of this period");
  }
  return (
    <div className="container py-12">
      <h1 className="text-3xl font-semibold text-gray-900">Seller plans</h1>
      <p className="mt-2 text-gray-600">
        Paid monthly from your Qwlee balance{data.balance != null ? ` (you have $${Number(data.balance).toFixed(2)})` : ""}. Cancel any time; the plan runs to the end of the period.
        Plus and Premium members get a badge on their gig cards and faster payout clearance.
      </p>
      {cur.id !== "free" && (
        <div className="mt-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900" data-testid="current-plan">
          You&rsquo;re on <b>{cur.label}</b>.{" "}
          {cur.cancelAtPeriodEnd ? `It ends on ${fmt(cur.renewsAt)}.` : `Renews on ${fmt(cur.renewsAt)} for $${cur.price}.`}{" "}
          {!cur.cancelAtPeriodEnd && <button onClick={stop} className="underline">Cancel</button>}
        </div>
      )}
      <div className="mt-8 grid md:grid-cols-3 gap-5">
        {data.plans.map((p) => {
          const active = p.id === cur.id;
          return (
            <div key={p.id} className={`rounded-2xl border p-6 bg-white ${active ? "border-emerald-500 ring-1 ring-emerald-500" : "border-gray-200"}`}>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{p.label}</div>
              <div className="mt-2 text-3xl font-semibold">{p.price ? `$${p.price}` : "Free"}<span className="text-base font-normal text-gray-500">{p.price ? " / month" : ""}</span></div>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                {p.perks.map((x) => <li key={x} className="flex gap-2"><IoCheckmarkCircle className="text-emerald-600 mt-0.5 shrink-0" />{x}</li>)}
              </ul>
              {p.id !== "free" && (
                <button
                  disabled={saving || (active && !cur.cancelAtPeriodEnd)}
                  onClick={() => pick(p.id)}
                  className="mt-6 w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {active ? (cur.cancelAtPeriodEnd ? "Resume" : "Current plan") : `Get ${p.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
