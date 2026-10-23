// KPI tile for the admin dashboard. Big value at the top, label below,
// optional delta (with up/down chevron in a tinted pill). Coloured icon
// in the corner reinforces the metric.

import cls from "../utils/cls";

const TONES = {
  emerald: { bg: "bg-primary-50", text: "text-primary-700" },
  sky: { bg: "bg-sky-50", text: "text-sky-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  violet: { bg: "bg-violet-50", text: "text-violet-700" },
  rose: { bg: "bg-rose-50", text: "text-rose-700" },
  slate: { bg: "bg-ink-100", text: "text-ink-700" },
};

export default function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "emerald",
  delta,
  trend,
}) {
  const tones = TONES[tone] || TONES.emerald;
  const direction = trend === "down" ? "down" : trend === "up" ? "up" : null;
  return (
    <article className="bg-white border border-ink-200 rounded-2xl shadow-card p-5 flex items-start gap-4">
      {Icon ? (
        <div className={cls("w-11 h-11 rounded-xl flex items-center justify-center", tones.bg)}>
          <Icon className={cls("w-5 h-5", tones.text)} />
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <div className="text-2xl md:text-3xl font-bold text-ink-900 truncate">{value}</div>
          {delta != null ? (
            <span
              className={cls(
                "text-xs font-medium px-1.5 py-0.5 rounded-full",
                direction === "down"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-primary-50 text-primary-700"
              )}
            >
              {direction === "down" ? "▼" : "▲"} {delta}
            </span>
          ) : null}
        </div>
        {hint ? <div className="text-xs text-ink-500 mt-1">{hint}</div> : null}
      </div>
    </article>
  );
}
