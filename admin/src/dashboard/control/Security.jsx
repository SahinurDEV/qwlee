// /dashboard/security — the signed-in admin's own two-factor sign-in.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { ErrorNote } from "./ui";

const input = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg outline-none focus:border-primary";

export default function Security() {
  const { data, error, reload } = useAdminQuery("/admin/2fa");
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (setup?.otpauthUrl) QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr);
  }, [setup]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Security" subtitle="Protect your admin account with a code from an authenticator app." />
      <ErrorNote error={error} />
      <Card title="Two-factor sign-in">
        {data ? (
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center gap-2 text-sm">
              Status: <StatusPill status={data.enabled ? "ok" : "pending"} label={data.enabled ? "On" : "Off"} />
              {data.enabled ? <span className="text-ink-500">· {data.recoveryLeft} recovery codes left</span> : null}
            </div>
            {codes ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Save these recovery codes now. Each works once if you lose your device; they won't be shown again.</p>
                <pre className="mt-2 grid grid-cols-2 gap-1 text-sm font-mono" data-testid="recovery-codes">{codes.join("\n")}</pre>
              </div>
            ) : null}
            {!data.enabled && !setup ? (
              <Button loading={busy} onClick={() => run(async () => setSetup(await adminFetch("/admin/2fa/setup", { method: "POST" })))}>Set up two-factor</Button>
            ) : null}
            {!data.enabled && setup ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-700">1. Scan this with Google Authenticator, 1Password, Authy or similar.</p>
                {qr ? <img src={qr} alt="Two-factor QR code" className="w-48 h-48 border border-ink-200 rounded-lg" /> : null}
                <p className="text-xs text-ink-500">Or enter this key: <code className="font-mono select-all" data-testid="totp-secret">{setup.secret}</code></p>
                <label className="block text-sm text-ink-700" htmlFor="code">2. Enter the 6-digit code it shows</label>
                <input id="code" className={input + " w-40"} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
                <Button loading={busy} onClick={() => run(async () => { const r = await adminFetch("/admin/2fa/enable", { method: "POST", body: { code } }); setCodes(r.recoveryCodes); setSetup(null); setCode(""); toast.success("Two-factor is on"); reload(); })}>Turn on</Button>
              </div>
            ) : null}
            {data.enabled ? (
              <div className="space-y-2">
                <label className="block text-sm text-ink-700" htmlFor="off">Turn off (enter a current code)</label>
                <div className="flex gap-2">
                  <input id="off" className={input + " w-40"} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
                  <Button variant="danger" loading={busy} onClick={() => run(async () => { await adminFetch("/admin/2fa/disable", { method: "POST", body: { code } }); setCode(""); setCodes(null); toast.success("Two-factor is off"); reload(); })}>Turn off</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
