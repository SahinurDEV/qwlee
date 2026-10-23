"use client";
// "Your data" on /profile/edit: download everything we store about you,
// or permanently delete the account (anonymised; orders and reviews stay
// for the other party's records).
import { useState } from "react";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { baseUrl } from "@/lib/constant";

const authHeader = () => {
  const t = Cookies.get("accessToken");
  return t ? { Authorization: `Bearer ${JSON.parse(t)}` } : {};
};

export default function PrivacySection() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState(null);

  const download = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${baseUrl}/users/me/export`, { headers: authHeader() });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message || "Export failed");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `qwlee-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Your data download has started");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const startDelete = async () => {
    setOpen(true);
    const r = await fetch(`${baseUrl}/users/me/delete-check`, { headers: authHeader() }).then((x) => x.json()).catch(() => null);
    setBlockers(r?.data?.attributes?.blockers || []);
  };
  const erase = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${baseUrl}/users/me/delete`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ password, confirm }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message || "Could not delete the account");
      ["user", "accessToken", "refreshToken"].forEach((c) => Cookies.remove(c));
      toast.success("Your account was deleted");
      setTimeout(() => window.location.assign("/"), 800);
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 mt-6" aria-labelledby="privacy-h">
      <h2 id="privacy-h" className="text-base font-semibold text-gray-900">Your data</h2>
      <p className="text-sm text-gray-500">Download a copy of everything we store about you, or delete your account.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" onClick={download} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Download my data</button>
        {!open ? <button type="button" onClick={startDelete} className="text-sm px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50">Delete my account</button> : null}
      </div>
      {open ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3" data-testid="delete-account">
          <p className="text-sm text-gray-700">
            This can&apos;t be undone. Your profile, gigs, favourites, saved replies and notifications are removed and you&apos;re signed out everywhere.
            Orders, payments, messages and reviews stay for the other party&apos;s records, shown as &quot;Deleted user&quot;.
          </p>
          {blockers?.length ? (
            <ul className="text-sm text-rose-700 list-disc pl-5" role="alert">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          ) : null}
          <input type="password" aria-label="Your password" placeholder="Your password (not needed for Google sign-in)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          <input aria-label="Type DELETE to confirm" placeholder="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          <div className="flex gap-2">
            <button type="button" onClick={erase} disabled={busy || confirm !== "DELETE" || (blockers && blockers.length > 0)} className="text-sm px-3 py-1.5 rounded-lg bg-rose-600 text-white disabled:opacity-40">Delete account permanently</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300">Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
