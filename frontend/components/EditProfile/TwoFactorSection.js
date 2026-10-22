"use client";
// Two-factor sign-in on /profile/edit: set up with an authenticator app,
// show the recovery codes once, or turn it off with a code.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  useGetTwoFactorQuery,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
} from "@/app/redux/features/twoFactorApi";

const msg = (r, d) => r?.error?.data?.message || d;

export default function TwoFactorSection() {
  const { data = {}, isLoading, refetch } = useGetTwoFactorQuery();
  const [setup, { isLoading: starting }] = useSetupTwoFactorMutation();
  const [enable, { isLoading: enabling }] = useEnableTwoFactorMutation();
  const [disable, { isLoading: disabling }] = useDisableTwoFactorMutation();
  const [pending, setPending] = useState(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(null);

  useEffect(() => {
    if (pending?.otpauthUrl) QRCode.toDataURL(pending.otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(""));
  }, [pending]);

  const start = async () => {
    const r = await setup();
    if (r.error) return toast.error(msg(r, "Could not start setup"));
    setPending(r.data?.data?.attributes);
    setCode("");
  };
  const confirm = async (e) => {
    e.preventDefault();
    const r = await enable(code.trim());
    if (r.error) return toast.error(msg(r, "That code is not valid"));
    setRecovery(r.data?.data?.attributes?.recoveryCodes || []);
    setPending(null);
    setCode("");
    toast.success("Two-factor is on");
    refetch();
  };
  const turnOff = async (e) => {
    e.preventDefault();
    const r = await disable(code.trim());
    if (r.error) return toast.error(msg(r, "Enter a valid code"));
    setCode("");
    toast.success("Two-factor is off");
    refetch();
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mt-6" aria-labelledby="tfa-h">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="tfa-h" className="text-base font-semibold text-gray-900">Two-factor sign-in</h2>
          <p className="text-sm text-gray-500">Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in.</p>
        </div>
        {!isLoading && (
          <span className={`text-xs rounded px-2 py-0.5 shrink-0 ${data.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
            {data.enabled ? "On" : "Off"}
          </span>
        )}
      </div>

      {recovery && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Save these recovery codes now</p>
          <p className="text-xs text-amber-800 mb-2">Each one signs you in once if you lose your phone. They won&apos;t be shown again.</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-gray-900">
            {recovery.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="mt-3 flex gap-3">
            <button type="button" className="text-sm text-emerald-700 hover:underline" onClick={() => navigator.clipboard?.writeText(recovery.join("\n")).then(() => toast.success("Copied"))}>Copy</button>
            <button type="button" className="text-sm text-gray-600 hover:underline" onClick={() => setRecovery(null)}>I&apos;ve saved them</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.enabled ? (
        <form onSubmit={turnOff} className="flex flex-wrap items-end gap-3">
          <p className="w-full text-sm text-gray-600">{data.recoveryLeft} recovery code{data.recoveryLeft === 1 ? "" : "s"} left.</p>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">Code to turn off</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="border border-gray-300 rounded-lg px-3 py-2 w-40" />
          </label>
          <button disabled={disabling || !code.trim()} className="text-sm px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50">Turn off</button>
        </form>
      ) : pending ? (
        <form onSubmit={confirm} className="flex flex-col sm:flex-row gap-4">
          {qr ? <img src={qr} alt="QR code to add Qwlee to your authenticator app" className="w-44 h-44 border border-gray-200 rounded-lg" /> : null}
          <div className="space-y-2 min-w-0">
            <p className="text-sm text-gray-700">1. Scan the QR code, or enter this key:</p>
            <code className="block text-xs break-all bg-gray-50 border border-gray-200 rounded px-2 py-1">{pending.secret}</code>
            <label className="block text-sm text-gray-700">
              <span className="block mb-1">2. Enter the 6-digit code it shows</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="border border-gray-300 rounded-lg px-3 py-2 w-40" />
            </label>
            <div className="flex gap-3">
              <button disabled={enabling || !code.trim()} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">Turn on</button>
              <button type="button" onClick={() => setPending(null)} className="text-sm text-gray-600 hover:underline">Cancel</button>
            </div>
          </div>
        </form>
      ) : (
        <button type="button" onClick={start} disabled={starting} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">Set up two-factor</button>
      )}
    </section>
  );
}
