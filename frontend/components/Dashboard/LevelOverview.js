"use client";
// Fiverr-style seller level overview.
//
// Sits between the KPI strip and the gigs table on /dashboard. Two
// columns on desktop:
//   • Current level + headline metrics (Success score, Rating,
//     Response rate)
//   • Progress toward the next level (Orders, Unique clients,
//     Earnings, Rating) — each a filled progress bar with the current
//     value and the target.
//
// Data comes from /v1/gig/mine/level via useGetMyLevelOverviewQuery.
// Loading state is a tasteful skeleton so the layout doesn't jump
// after the API resolves.

import Link from "next/link";
import {
  IoStarOutline,
  IoTrophyOutline,
  IoFlashOutline,
  IoSpeedometerOutline,
  IoArrowForwardOutline,
} from "react-icons/io5";

import { useGetMyLevelOverviewQuery } from "@/app/redux/features/sellerLevelApi";

export default function LevelOverview() {
  const { data, isFetching } = useGetMyLevelOverviewQuery();

  if (isFetching && !data) {
    return (
      <section className="mb-6 md:mb-8 bg-white border border-gray-100 rounded-2xl p-5 md:p-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-100 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-gray-50 rounded-xl" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { user, currentLevel, nextLevel, metrics, progress } = data;
  const atTop = !nextLevel;

  return (
    <section className="mb-6 md:mb-8 bg-white border border-gray-100 rounded-2xl p-5 md:p-6">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
            <IoTrophyOutline className="text-emerald-600" />
            Level overview
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            How the level system works — earn higher tiers by delivering
            consistently.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Current level
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold">
            {currentLevel?.label || "Level 0"}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Metrics column */}
        <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            My performance metrics
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Keep an eye on these stats to monitor your progress in the
            level system.
          </p>

          <Metric
            icon={IoFlashOutline}
            label="Success score"
            value={
              metrics?.successScore != null ? metrics.successScore : "—"
            }
            max={10}
            tone="emerald"
          />
          <Metric
            icon={IoFlashOutline}
            label="Job Success"
            value={data?.jobSuccess?.score != null ? `${data.jobSuccess.score}%` : "—"}
            sub={data?.jobSuccess?.score != null ? `last ${data.jobSuccess.windowMonths} months` : `needs ${data?.jobSuccess?.minOrders || 5} closed orders`}
            tone="emerald"
          />
          <Metric
            icon={IoStarOutline}
            label="Rating"
            value={
              metrics?.rating != null ? Number(metrics.rating).toFixed(1) : "—"
            }
            max={5}
            sub={
              metrics?.totalReviews > 0
                ? `${metrics.totalReviews} review${metrics.totalReviews === 1 ? "" : "s"}`
                : "No reviews yet"
            }
            tone="amber"
          />
          <Metric
            icon={IoSpeedometerOutline}
            label="Response rate"
            value={`${metrics?.responseRate ?? 100}%`}
            max={100}
            tone="sky"
          />
        </div>

        {/* Progress column */}
        <div className="bg-gradient-to-br from-emerald-50/50 via-white to-white border border-emerald-100 rounded-xl p-5">
          {atTop ? (
            <div className="h-full flex flex-col items-start justify-center">
              <IoTrophyOutline className="w-8 h-8 text-emerald-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-900">
                You&rsquo;re Top Rated 🎉
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                You&rsquo;ve reached the highest tier. Keep delivering
                consistently to stay there.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Qualifies for{" "}
                  <span className="text-emerald-700">{nextLevel?.label}</span>
                </h3>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
                  Next <IoArrowForwardOutline />
                </span>
              </div>

              <Progress
                label="Orders"
                value={progress?.orders?.value}
                target={progress?.orders?.target}
              />
              <Progress
                label="Unique clients"
                value={progress?.uniqueClients?.value}
                target={progress?.uniqueClients?.target}
              />
              <Progress
                label="Earnings"
                value={progress?.earnings?.value}
                target={progress?.earnings?.target}
                money
              />
              <Progress
                label="Rating"
                value={progress?.rating?.value}
                target={progress?.rating?.target}
                star
                decimals={1}
              />
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        Tip: keep delivering on time and replying to messages quickly. See{" "}
        <Link href="/support" className="text-emerald-700 hover:underline">
          how levels work
        </Link>{" "}
        for full details.
      </p>
    </section>
  );
}

function Metric({ icon: Icon, label, value, max, sub, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          tones[tone] || tones.emerald
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
            {label}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {value} <span className="text-gray-300">/ {max}</span>
          </span>
        </div>
        {sub ? (
          <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function Progress({ label, value, target, money, star, decimals = 0 }) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  const pct = t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
  const fmt = (n) =>
    money ? `US$${Number(n).toLocaleString()}` : star ? `${Number(n).toFixed(decimals)}★` : `${n}`;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-800">{label}</span>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {fmt(decimals ? v.toFixed(decimals) : v)}{" "}
          <span className="text-gray-400 font-normal">/ {fmt(t)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
