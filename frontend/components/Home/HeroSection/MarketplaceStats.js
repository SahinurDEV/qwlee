"use client";
// Live marketplace counters pulled from GET /v1/info/stats. Renders four
// numbers in a thin band below the hero slider so the homepage doesn't
// feel hollow even before the user scrolls.
//
// Each number is shown as soon as the stats load.
// `useMotionValue` + `animate` when the strip enters the viewport, so
// the figures feel earned. Once.

import { useI18n } from "@/components/Context/I18nProvider";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base } from "@/lib/constant";
import { IoStar, IoShieldCheckmarkOutline, IoLockClosedOutline, IoHeadsetOutline } from "react-icons/io5";

function formatCount(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k+`;
  return String(n);
}

// Plain counter. The old tick-up animation only ran once the strip was
// "in view", so it could stay stuck at 0 (e.g. after a fast scroll or on
// some mobile browsers). Show the real number straight away.
function Counter({ value }) {
  return <span className="tabular-nums">{formatCount(value)}</span>;
}

export default function MarketplaceStats() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${base}/v1/info/stats`, {
          signal: ctrl.signal,
          headers: { "ngrok-skip-browser-warning": "1" },
        });
        const json = await res.json();
        setStats(json?.data?.attributes || null);
      } catch (err) {
        if (err?.name !== "AbortError") setErrored(true);
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (errored) return null;

  const items = [
    { label: "Verified sellers", value: stats?.sellers },
    { label: "Active gigs", value: stats?.gigs },
    { label: "Orders shipped", value: stats?.orders },
    { label: "Countries", value: stats?.countries },
  ];

  return (
    <section className="container mx-auto px-4 -mt-8 md:-mt-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px 0px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-white rounded-2xl border border-gray-100 p-4 md:p-6"
        style={{ boxShadow: "0 8px 32px rgba(15,23,42,0.08)" }}
      >
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px 0px" }}
            transition={{
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1 + i * 0.07,
            }}
            className="text-center md:text-left px-2 md:px-4"
          >
            <div className="text-2xl md:text-3xl font-bold text-gray-900">
              <Counter value={it.value} />
            </div>
            <div className="text-xs md:text-sm text-gray-500 mt-1 uppercase tracking-wide">
              {t(it.label)}
            </div>
          </motion.div>
        ))}
      </motion.div>
      <ul className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-sm" aria-label="Why buyers trust Qwlee">
        {stats?.reviews ? (
          <li className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2.5">
            <IoStar className="text-amber-500 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold text-gray-900">{stats.avgRating?.toFixed(1)}/5</span>{" "}
              <span className="text-gray-500">{t("from")} {formatCount(stats.reviews)} {t("reviews")}</span>
            </span>
          </li>
        ) : null}
        <li className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2.5">
          <IoShieldCheckmarkOutline className="text-emerald-600 shrink-0" aria-hidden />
          <span className="text-gray-700">{t("Project done or your money back")}</span>
        </li>
        <li className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2.5">
          <IoLockClosedOutline className="text-emerald-600 shrink-0" aria-hidden />
          <span className="text-gray-700">{t("Secure payments held in escrow")}</span>
        </li>
        <li className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2.5">
          <IoHeadsetOutline className="text-emerald-600 shrink-0" aria-hidden />
          <span className="text-gray-700">{t("Support and dispute help")}</span>
        </li>
      </ul>
    </section>
  );
}
