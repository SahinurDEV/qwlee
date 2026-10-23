// Tone-mapped status badge. Keeps the same vocabulary across every
// list page (users, orders, withdrawals, blogs) so glancing at a row
// status is instant.

import cls from "../utils/cls";

const TONE_MAP = {
  // generic
  ok: "bg-primary-50 text-primary-700 border-primary-100",
  success: "bg-primary-50 text-primary-700 border-primary-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  error: "bg-rose-50 text-rose-700 border-rose-100",
  info: "bg-sky-50 text-sky-700 border-sky-100",
  muted: "bg-ink-100 text-ink-700 border-ink-200",
  // order/payment states
  active: "bg-primary-50 text-primary-700 border-primary-100",
  delivered: "bg-sky-50 text-sky-700 border-sky-100",
  completed: "bg-primary-50 text-primary-800 border-primary-200",
  late: "bg-rose-50 text-rose-700 border-rose-100",
  cancelled: "bg-ink-100 text-ink-700 border-ink-200",
  approved: "bg-primary-50 text-primary-700 border-primary-100",
  rejected: "bg-rose-50 text-rose-700 border-rose-100",
};

const DOT = {
  ok: "bg-primary-500",
  success: "bg-primary-500",
  pending: "bg-amber-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
  muted: "bg-ink-400",
  active: "bg-primary-500",
  delivered: "bg-sky-500",
  completed: "bg-primary-600",
  late: "bg-rose-500",
  cancelled: "bg-ink-400",
  approved: "bg-primary-500",
  rejected: "bg-rose-500",
};

export default function StatusPill({ status, label }) {
  const key = String(status || "muted").toLowerCase();
  const cls1 = TONE_MAP[key] || TONE_MAP.muted;
  const dot = DOT[key] || DOT.muted;
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border",
        cls1
      )}
    >
      <span className={cls("w-1.5 h-1.5 rounded-full", dot)} />
      {label || prettify(key)}
    </span>
  );
}

function prettify(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
