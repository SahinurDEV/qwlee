// Shown instead of every page while maintenance mode is on
// (Admin → Site settings → Maintenance).
export default function MaintenancePage({ siteName = "Qwlee", message, until }) {
  const back = until ? new Date(until) : null;
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6" data-testid="maintenance">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold">{siteName.slice(0, 1)}</div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{siteName} is down for maintenance</h1>
        <p className="mt-3 text-gray-600 whitespace-pre-line">{message || "We're making some improvements and will be back shortly."}</p>
        {back && !Number.isNaN(back.getTime()) ? (
          <p className="mt-4 text-sm text-gray-500">
            Expected back by <time dateTime={back.toISOString()}>{back.toUTCString().replace(" GMT", " UTC")}</time>
          </p>
        ) : null}
      </div>
    </main>
  );
}
