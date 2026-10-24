"use client";
// Shows active warnings or a restriction on the signed-in account.
import Link from "next/link";
import { baseApi } from "@/app/redux/api/baseApi";

const standingApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMyStanding: b.query({ query: () => "/users/me/standing", transformResponse: (r) => r?.data?.attributes || null }),
  }),
});
export const { useGetMyStandingQuery } = standingApi;

const day = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function StandingBanner() {
  const { data } = useGetMyStandingQuery();
  if (!data) return null;
  const { restriction, warnings = [] } = data;
  if (restriction) {
    return (
      <div role="alert" className="container mx-auto px-4 mt-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="font-semibold">Your account is restricted until {day(restriction.until)}</div>
          <p className="mt-1">{restriction.reason} You can finish and deliver current orders, message buyers on them, and withdraw cleared earnings. New gigs, offers, conversations and orders are blocked.</p>
          <p className="mt-1">Read the <Link href="/community-standards" className="underline">Community Standards</Link> or <Link href="/support" className="underline">contact support</Link> if you think this is a mistake.</p>
        </div>
      </div>
    );
  }
  if (!warnings.length) return null;
  return (
    <div role="status" className="container mx-auto px-4 mt-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">{warnings.length === 1 ? "Your account has a warning" : `Your account has ${warnings.length} warnings`}</div>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          {warnings.map((w) => <li key={w.id}>{w.label}{w.note ? ` — ${w.note}` : ""} (expires {day(w.expiresAt)})</li>)}
        </ul>
        <p className="mt-1">Repeated problems can lead to a restriction. See the <Link href="/community-standards" className="underline">Community Standards</Link>.</p>
      </div>
    </div>
  );
}
