"use client";
// /referrals — your invite link, progress and the coupons you hold.
import { toast } from "sonner";
import { IoCopyOutline, IoGiftOutline } from "react-icons/io5";
import { baseApi } from "@/app/redux/api/baseApi";
import useUser from "@/hooks/useUser";

const api = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMyReferrals: b.query({ query: () => "/growth/referrals/me", transformResponse: (r) => r?.data?.attributes, keepUnusedDataFor: 0 }),
  }),
});

export default function Referrals() {
  const user = useUser();
  const { data, isLoading, error } = api.useGetMyReferralsQuery(undefined, { skip: !user });
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed — select and copy it manually");
    }
  };
  if (!user) return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-gray-600">Sign in to see your invite link.</p></main>;
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <IoGiftOutline className="text-3xl text-emerald-600" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Invite friends</h1>
          {data ? <p className="text-sm text-gray-600">They get {data.refereePercent}% off their first order. You get ${data.referrerReward} off when it completes.</p> : null}
        </div>
      </div>
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : error ? <p role="alert" className="text-sm text-rose-600">Could not load your referrals.</p> : !data?.enabled ? (
        <p className="text-sm text-gray-600">The referral programme is paused right now.</p>
      ) : (
        <>
          <section className="bg-white border border-gray-200 rounded-2xl p-5">
            <label htmlFor="ref-link" className="text-sm font-medium text-gray-800">Your invite link</label>
            <div className="mt-2 flex gap-2">
              <input id="ref-link" readOnly value={data.link} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => copy(data.link)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm"><IoCopyOutline /> Copy</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Friends joined</dt><dd className="text-xl font-semibold text-gray-900">{data.invited}</dd></div>
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Rewards earned</dt><dd className="text-xl font-semibold text-gray-900">{data.rewarded}</dd></div>
            </dl>
          </section>
          <section className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-gray-900">Your coupons</h2>
            {data.coupons.length === 0 ? <p className="mt-2 text-sm text-gray-500">No coupons yet.</p> : (
              <ul className="mt-3 divide-y divide-gray-100">
                {data.coupons.map((c) => (
                  <li key={c.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="font-mono font-semibold text-gray-900">{c.code}</p>
                      <p className="text-xs text-gray-500">{c.description}{c.firstOrderOnly ? " · first order" : ""}{c.expiresAt ? ` · until ${new Date(c.expiresAt).toLocaleDateString()}` : ""}</p>
                    </div>
                    {c.used ? <span className="text-xs text-gray-400">Used</span> : <button type="button" onClick={() => copy(c.code)} className="text-xs text-emerald-700 hover:underline">Copy code</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
