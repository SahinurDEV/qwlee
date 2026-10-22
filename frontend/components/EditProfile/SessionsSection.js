"use client";
// "Where you're signed in" on /profile/edit: every device with an active
// session, and a button to sign each one (or all others) out.
import { toast } from "sonner";
import { IoDesktopOutline, IoPhonePortraitOutline } from "react-icons/io5";
import { useGetSessionsQuery, useRevokeSessionMutation, useRevokeOtherSessionsMutation } from "@/app/redux/features/sessionsApi";

function device(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { label: `${browser} on ${os}`, mobile: /Mobile|Android|iPhone/.test(ua) };
}
const when = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function SessionsSection() {
  const { data = [], isLoading, refetch } = useGetSessionsQuery();
  const [revoke] = useRevokeSessionMutation();
  const [revokeOthers, { isLoading: busy }] = useRevokeOtherSessionsMutation();
  const others = data.filter((s) => !s.current).length;
  const one = async (sid) => {
    const r = await revoke(sid);
    if (r.error) return toast.error(r.error?.data?.message || "Could not sign out that device");
    toast.success("Signed out on that device");
    refetch();
  };
  const all = async () => {
    const r = await revokeOthers();
    if (r.error) return toast.error(r.error?.data?.message || "Could not sign out other devices");
    toast.success(r.data?.message || "Signed out other devices");
    refetch();
  };
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mt-6" aria-labelledby="sessions-h">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 id="sessions-h" className="text-base font-semibold text-gray-900">Where you&apos;re signed in</h2>
          <p className="text-sm text-gray-500">Sign out any device you don&apos;t recognise.</p>
        </div>
        {others > 0 ? (
          <button type="button" onClick={all} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
            Sign out all other devices
          </button>
        ) : null}
      </div>
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <ul className="divide-y divide-gray-100">
          {data.map((s) => {
            const d = device(s.userAgent);
            const Icon = d.mobile ? IoPhonePortraitOutline : IoDesktopOutline;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="text-xl text-gray-500 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{d.label}{s.current ? <span className="ml-2 text-xs text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">This device</span> : null}</p>
                    <p className="text-xs text-gray-500 truncate">{s.ip || "Unknown IP"} · signed in {when(s.createdAt)} · last active {when(s.lastSeenAt)}</p>
                  </div>
                </div>
                {!s.current ? (
                  <button type="button" onClick={() => one(s.id)} className="text-sm text-rose-600 hover:underline shrink-0">Sign out</button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
