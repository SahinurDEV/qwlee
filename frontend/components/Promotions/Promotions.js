"use client";
// /promotions: sellers pay a daily price from their balance to show a gig
// as "Sponsored" above matching search results.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { IoMegaphoneOutline } from "react-icons/io5";
import { useGetMyGigsStatsQuery } from "@/app/redux/features/sellerLevelApi";
import { useGetPromotionsQuery, useCreatePromotionMutation, useCancelPromotionMutation } from "@/app/redux/features/promotionsApi";

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const STATUS = {
  running: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-sky-50 text-sky-700",
  ended: "bg-gray-100 text-gray-600",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function Promotions() {
  const params = useSearchParams();
  const { data: stats } = useGetMyGigsStatsQuery();
  const { data, isLoading } = useGetPromotionsQuery();
  const [create, { isLoading: buying }] = useCreatePromotionMutation();
  const [cancel] = useCancelPromotionMutation();
  const active = (stats?.gigs || []).filter((g) => g.status === "active");
  const [gigId, setGigId] = useState("");
  const [days, setDays] = useState(7);
  const price = data?.dayPrice || 0;
  const maxDays = data?.maxDays || 30;

  useEffect(() => {
    if (gigId || !active.length) return;
    const wanted = params.get("gig");
    setGigId(active.some((g) => String(g._id) === wanted) ? wanted : String(active[0]._id));
  }, [active, gigId, params]);

  async function buy(e) {
    e.preventDefault();
    try {
      const r = await create({ gigId, days: Number(days) }).unwrap();
      toast.success(`Promoted. Balance now $${r?.data?.attributes?.balance}`);
    } catch (err) {
      toast.error(err?.data?.message || "Could not promote the gig");
    }
  }

  async function stop(p) {
    if (!window.confirm(`Stop promoting "${p.gig?.title}"? Whole unused days are refunded to your balance.`)) return;
    try {
      const r = await cancel(p.id).unwrap();
      toast.success(`Promotion stopped. Refunded $${r?.data?.attributes?.refund}`);
    } catch (err) {
      toast.error(err?.data?.message || "Could not stop the promotion");
    }
  }

  const cost = Math.round(Number(days || 0) * price * 100) / 100;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <IoMegaphoneOutline className="w-7 h-7 text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Promote your gigs</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        A promoted gig appears as <strong>Sponsored</strong> above matching search results (up to {data?.slots || 2} per search). It costs ${price} a day, paid from your balance. If you stop early, whole unused days are refunded.
      </p>

      <form onSubmit={buy} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="text-sm">
          <span className="block font-medium text-gray-700 mb-1">Gig</span>
          <select value={gigId} onChange={(e) => setGigId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={!active.length}>
            {active.length ? active.map((g) => <option key={g._id} value={g._id}>{g.title}</option>) : <option>No active gigs</option>}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-gray-700 mb-1">Days</span>
          <input type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(e.target.value)} className="w-24 rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <button disabled={buying || !gigId || !active.length} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          Promote for ${cost}
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold text-gray-900">Your promotions</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : !data?.results?.length ? (
        <p className="mt-3 text-sm text-gray-500">No promotions yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Gig</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3 text-right">Cost</th>
                <th className="px-3 py-3 text-right">Impressions</th>
                <th className="px-3 py-3 text-right">Clicks</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.results.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 max-w-[220px] truncate">
                    {p.gig ? <Link href={`/gig/${p.gig.slug}`} className="text-emerald-700 hover:underline">{p.gig.title}</Link> : "Deleted gig"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-600">{fmtDate(p.startsAt)} – {fmtDate(p.endsAt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">${p.cost}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.impressions}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.clicks}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[p.status] || ""}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {(p.status === "running" || p.status === "scheduled") && (
                      <button onClick={() => stop(p)} className="text-xs text-rose-700 hover:underline">Stop</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
