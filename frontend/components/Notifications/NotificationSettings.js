"use client";
// /notifications/settings: email and browser-push switches per category,
// plus turning browser notifications on/off for this browser.
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IoArrowBack } from "react-icons/io5";
import {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  usePushSubscribeMutation,
  usePushUnsubscribeMutation,
  usePushTestMutation,
} from "@/app/redux/features/notificationSettingsApi";

const b64ToBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-emerald-600" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function NotificationSettings() {
  const { data, isLoading, refetch } = useGetNotificationSettingsQuery();
  const [save] = useUpdateNotificationSettingsMutation();
  const [subscribe] = usePushSubscribeMutation();
  const [unsubscribe] = usePushUnsubscribeMutation();
  const [testPush, { isLoading: testing }] = usePushTestMutation();
  const [prefs, setPrefs] = useState(null);
  const [browser, setBrowser] = useState({ supported: false, permission: "default", subscribed: false, busy: false });

  useEffect(() => {
    if (data?.prefs) setPrefs(data.prefs);
  }, [data]);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => (reg ? reg.pushManager.getSubscription() : null))
      .then((sub) => setBrowser((b) => ({ ...b, supported, permission: Notification.permission, subscribed: !!sub })))
      .catch(() => setBrowser((b) => ({ ...b, supported, permission: Notification.permission })));
  }, []);

  const set = async (channel, cat, value) => {
    const prev = prefs;
    setPrefs({ ...prefs, [channel]: { ...prefs[channel], [cat]: value } });
    const r = await save({ [channel]: { [cat]: value } });
    if (r.error) {
      setPrefs(prev);
      return toast.error(r.error?.data?.message || "Could not save");
    }
    setPrefs(r.data?.data?.attributes?.prefs || prev);
    toast.success("Saved");
  };

  const turnOn = async () => {
    setBrowser((b) => ({ ...b, busy: true }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setBrowser((b) => ({ ...b, permission, busy: false }));
        return toast.error("Notifications are blocked for this site in your browser settings.");
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.push.publicKey) }));
      const r = await subscribe(sub.toJSON());
      if (r.error) throw new Error(r.error?.data?.message || "Could not save this browser");
      setBrowser((b) => ({ ...b, permission, subscribed: true, busy: false }));
      toast.success("Browser notifications are on");
      refetch();
    } catch (e) {
      setBrowser((b) => ({ ...b, busy: false }));
      toast.error(e?.message || "Could not turn on browser notifications");
    }
  };

  const turnOff = async () => {
    setBrowser((b) => ({ ...b, busy: true }));
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        await unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setBrowser((b) => ({ ...b, subscribed: false, busy: false }));
      toast.success("Browser notifications are off for this browser");
      refetch();
    } catch {
      setBrowser((b) => ({ ...b, busy: false }));
    }
  };

  const cats = data?.categories || {};
  const locked = data?.emailLocked || [];
  const push = data?.push || {};

  return (
    <main className="bg-gray-50/40 min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-10 max-w-3xl">
        <Link href="/notifications" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3">
          <IoArrowBack aria-hidden /> Notifications
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Notification settings</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">You always see every notification here on Qwlee. Choose what also reaches your inbox and this browser.</p>

        <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-6" aria-labelledby="bn-h">
          <h2 id="bn-h" className="text-base font-semibold text-gray-900">Browser notifications</h2>
          {!push.enabled ? (
            <p className="text-sm text-gray-500 mt-1">Browser notifications aren&apos;t set up on this site yet.</p>
          ) : !browser.supported ? (
            <p className="text-sm text-gray-500 mt-1">This browser doesn&apos;t support notifications.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
              <p className="text-sm text-gray-500">
                {browser.subscribed
                  ? "On for this browser."
                  : browser.permission === "denied"
                    ? "Blocked in your browser settings for this site."
                    : "Get a pop-up even when Qwlee isn't open."}
                {push.devices ? ` ${push.devices} browser${push.devices === 1 ? "" : "s"} signed up.` : ""}
              </p>
              <div className="flex gap-2">
                {browser.subscribed ? (
                  <>
                    <button type="button" disabled={testing} onClick={async () => { const r = await testPush(); toast[r.error ? "error" : "success"](r.data?.message || r.error?.data?.message || "Done"); }} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Send a test</button>
                    <button type="button" disabled={browser.busy} onClick={turnOff} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Turn off</button>
                  </>
                ) : (
                  <button type="button" disabled={browser.busy || browser.permission === "denied"} onClick={turnOn} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">Turn on</button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5" aria-labelledby="np-h">
          <h2 id="np-h" className="text-base font-semibold text-gray-900 mb-3">What to send</h2>
          {isLoading || !prefs ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="font-medium pb-2">Category</th>
                  <th className="font-medium pb-2 w-20 text-center">Email</th>
                  <th className="font-medium pb-2 w-20 text-center">Browser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(cats).map(([key, label]) => (
                  <tr key={key}>
                    <td className="py-3 pr-3 text-gray-800">
                      {label}
                      {locked.includes(key) ? <span className="block text-xs text-gray-500">Payment emails are always sent.</span> : null}
                    </td>
                    <td className="py-3 text-center">
                      <Toggle label={`Email: ${label}`} checked={!!prefs.email?.[key]} disabled={locked.includes(key)} onChange={(v) => set("email", key, v)} />
                    </td>
                    <td className="py-3 text-center">
                      <Toggle label={`Browser: ${label}`} checked={!!prefs.push?.[key]} onChange={(v) => set("push", key, v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-500 mt-3">Sign-in codes, password resets, payouts and account notices are always emailed.</p>
        </section>
      </div>
    </main>
  );
}
