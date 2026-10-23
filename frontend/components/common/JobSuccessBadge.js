"use client";
// Job Success Score pill (share of recent orders that ended well).
// Renders nothing until the seller has enough closed orders.
import { useEffect, useState } from "react";
import { base } from "@/lib/constant";

export default function JobSuccessBadge({ userId, className = "" }) {
  const [jss, setJss] = useState(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetch(`${base}/v1/users/${userId}/job-success`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setJss(j?.data?.attributes || null))
      .catch(() => {});
    return () => { live = false; };
  }, [userId]);
  if (!jss || jss.score === null || jss.score === undefined) return null;
  const tone = jss.score >= 90 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : jss.score >= 75 ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span
      data-testid="job-success"
      title={`Based on ${jss.positive + jss.negative} closed orders in the last ${jss.windowMonths} months`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${tone} ${className}`}
    >
      {jss.score}% Job Success{jss.badge ? ` · ${jss.badge}` : ""}
    </span>
  );
}
