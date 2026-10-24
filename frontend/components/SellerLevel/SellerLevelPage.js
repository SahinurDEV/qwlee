"use client";
// Seller progress page: your level, progress to the next one, and the
// criteria for every level (set by the qwlee team in admin).
import Link from "next/link";
import LevelOverview from "@/components/Dashboard/LevelOverview";
import { useGetMyLevelOverviewQuery } from "@/app/redux/features/sellerLevelApi";

const money = (n) => `US$${Number(n || 0).toLocaleString()}`;

export default function SellerLevelPage() {
  const { data, isError } = useGetMyLevelOverviewQuery();
  const tiers = (data?.tiers || []).filter((t) => t.id !== "level0");
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Seller levels</h1>
      <p className="text-sm text-gray-600 mt-2 max-w-2xl">
        Levels are checked automatically every hour from your last 12 months of completed orders, reviews and replies. Higher levels unlock more gigs, faster payouts and more visibility.
      </p>
      {isError ? (
        <p className="mt-6 text-sm text-gray-600">
          <Link href="/auth/login" className="text-emerald-700 underline">Sign in</Link> as a seller to see your progress.
        </p>
      ) : (
        <div className="mt-6"><LevelOverview /></div>
      )}
      {tiers.length ? (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6" aria-labelledby="crit-h">
          <h2 id="crit-h" className="text-lg font-bold text-gray-900 mb-3">What each level needs</h2>
          <div className="overflow-x-auto -mx-5 md:mx-0">
            <table className="min-w-[560px] w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Level</th>
                  <th className="text-right px-3 py-2">Orders</th>
                  <th className="text-right px-3 py-2">Clients</th>
                  <th className="text-right px-3 py-2">Earnings</th>
                  <th className="text-right px-3 py-2">Rating</th>
                  <th className="text-right px-3 py-2">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiers.map((t) => (
                  <tr key={t.id} className={data?.currentLevel?.id === t.id ? "bg-emerald-50" : ""}>
                    <td className="px-3 py-2 font-medium text-gray-900">{t.label}{t.requiresApproval ? <span className="block text-xs font-normal text-gray-500">plus team review</span> : null}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.minOrders}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.minClients}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.minEarnings)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(t.minRating).toFixed(1)}★</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.minResponseRate || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">Policy warnings can hold back a promotion. See the <Link href="/community-standards" className="text-emerald-700 underline">community standards</Link>.</p>
        </section>
      ) : null}
    </main>
  );
}
