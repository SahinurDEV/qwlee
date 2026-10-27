"use client";
// Horizontal order status timeline (placed → requirements → in progress →
// delivered → completed). Branch states: late, cancelled, disputed.
import { IoCheckmark, IoClose, IoFlagOutline } from "react-icons/io5";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;

function buildSteps(order) {
  const status = order?.status || "active";
  const req = order?.requirementsStatus;
  const delivery = order?.delivery || {};
  const placedAt = order?.createdAt;
  const reqAt = order?.requirementsSubmittedAt;
  const deliveredAt = delivery.lastDeliveredAt;
  const completedAt = order?.completedAt;
  const cancelledAt = order?.cancelledAt;

  const steps = [
    { key: "placed", label: "Placed", at: placedAt, done: true },
  ];

  if (req && req !== "not_required") {
    steps.push({
      key: "requirements",
      label: "Requirements",
      at: reqAt,
      done: req === "submitted" || ["delivered", "completed", "cancelled", "disputed", "late", "active"].includes(status) && !!reqAt,
      current: req === "pending" && status === "active",
    });
    // If still pending and active, mark current
    if (req === "pending" && (status === "active" || status === "late")) {
      steps[steps.length - 1].current = true;
      steps[steps.length - 1].done = false;
    }
  }

  const inProgressDone = ["delivered", "completed", "cancelled", "disputed"].includes(status) || delivery.state === "submitted" || delivery.state === "accepted" || delivery.state === "revision";
  steps.push({
    key: "progress",
    label: status === "late" ? "Late" : "In progress",
    at: reqAt || placedAt,
    done: inProgressDone || status === "active" || status === "late",
    current: (status === "active" || status === "late") && delivery.state === "none" && (req === "submitted" || req === "not_required" || !req),
    warn: status === "late",
  });

  steps.push({
    key: "delivered",
    label: "Delivered",
    at: deliveredAt,
    done: ["delivered", "completed"].includes(status) || delivery.state === "accepted" || (delivery.state === "submitted" && status !== "active"),
    current: status === "delivered" || delivery.state === "submitted",
  });

  if (status === "cancelled") {
    steps.push({ key: "cancelled", label: "Cancelled", at: cancelledAt, done: true, bad: true, current: true });
  } else if (status === "disputed") {
    steps.push({ key: "disputed", label: "Disputed", at: null, done: true, bad: true, current: true });
  } else {
    steps.push({
      key: "completed",
      label: "Completed",
      at: completedAt,
      done: status === "completed",
      current: false,
    });
  }

  // Ensure exactly one current when possible
  if (!steps.some((s) => s.current)) {
    const lastDone = [...steps].reverse().find((s) => s.done);
    if (lastDone && !lastDone.bad && status !== "completed" && status !== "cancelled") {
      // leave no current for completed
    } else if (status === "completed") {
      steps[steps.length - 1].current = true;
    }
  }

  return steps;
}

export default function OrderTimeline({ order }) {
  if (!order) return null;
  const steps = buildSteps(order);

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 mb-6"
      data-testid="order-timeline"
      aria-label="Order timeline"
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Order timeline</h2>
      <ol className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-0">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const tone = s.bad
            ? "bg-rose-500 text-white"
            : s.done
              ? "bg-emerald-500 text-white"
              : s.current
                ? "bg-emerald-100 text-emerald-900 border-2 border-emerald-500"
                : "bg-gray-100 text-gray-500";
          return (
            <li key={s.key} className="relative flex sm:flex-1 gap-3 sm:flex-col sm:items-center sm:text-center pb-4 sm:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[15px] top-8 bottom-0 w-0.5 sm:left-auto sm:right-0 sm:top-[15px] sm:bottom-auto sm:h-0.5 sm:w-full sm:translate-x-1/2 ${
                    s.done && !s.bad ? "bg-emerald-300" : "bg-gray-200"
                  }`}
                />
              )}
              <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone}`}>
                {s.bad ? <IoClose className="w-4 h-4" /> : s.done ? <IoCheckmark className="w-4 h-4" /> : s.warn ? <IoFlagOutline className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 sm:mt-2">
                <div className={`text-sm font-medium ${s.current ? "text-emerald-900" : "text-gray-900"}`}>{s.label}</div>
                {fmt(s.at) ? <div className="text-xs text-gray-500">{fmt(s.at)}</div> : s.current ? <div className="text-xs text-emerald-700">Current</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
