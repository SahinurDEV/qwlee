"use client";
// Shared KPI tile. One source of truth for the metric cards across the
// freelancer and buyer dashboards so both stay visually consistent.

import { SkeletonBlock } from "@/components/common/Skeleton";

export default function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "emerald",
  loading = false,
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 md:p-5 min-w-0"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[11px] sm:text-xs font-medium uppercase tracking-wide sm:tracking-wider text-gray-500 leading-snug">
          {label}
        </div>
        {Icon ? (
          <span
            className={`hidden sm:inline-flex shrink-0 w-9 h-9 items-center justify-center rounded-xl ${
              tones[tone] || tones.emerald
            }`}
          >
            <Icon className="w-5 h-5" />
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        {loading ? (
          <SkeletonBlock className="h-7 w-20" />
        ) : (
          <div className="text-2xl md:text-3xl font-bold text-gray-900">
            {value ?? "—"}
          </div>
        )}
      </div>
      {hint ? (
        <div className="text-xs text-gray-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}
