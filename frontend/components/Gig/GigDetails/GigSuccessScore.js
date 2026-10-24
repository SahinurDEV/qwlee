"use client";
// Seller-only: this gig's Success Score (1–10). Hidden from buyers.
import useUser from "@/hooks/useUser";
import { useGetGigSuccessScoreQuery } from "@/app/redux/features/sellerLevelApi";
import Link from "next/link";

export default function GigSuccessScore({ gigId, sellerId }) {
  const user = useUser();
  const mine = !!user?.id && String(user.id) === String(sellerId || "");
  const { data } = useGetGigSuccessScoreQuery(gigId, { skip: !mine || !gigId });
  if (!mine || !data) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
      <span className="font-semibold text-emerald-900">
        Success Score: {data.score != null ? `${data.score}/10` : "not yet"}
      </span>
      <span className="text-xs text-emerald-800">
        {data.score != null ? `${data.orders} orders in the last ${data.windowDays} days` : `shows after ${data.minOrders} closed orders`} · only you see this
      </span>
      <Link href="/seller-level" className="text-xs text-emerald-700 underline ml-auto">How it works</Link>
    </div>
  );
}
