// Optional client error reporting. Set NEXT_PUBLIC_SENTRY_DSN to enable.
export function captureException(err, context = {}) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.NEXT_PUBLIC_ERROR_REPORTING_DSN;
  if (!dsn || typeof window === "undefined") return;
  try {
    // Lazy: only report; full Sentry SDK can replace this later.
    const payload = { message: err?.message || String(err), stack: err?.stack, context, ts: new Date().toISOString(), service: "qwlee-web" };
    navigator.sendBeacon?.(dsn, JSON.stringify(payload));
  } catch {}
}
