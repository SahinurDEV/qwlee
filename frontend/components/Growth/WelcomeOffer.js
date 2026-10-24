"use client";
// Homepage strip for the first-order discount. Signed out: invite to
// sign up. Signed in with an unused welcome coupon: show the code.
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IoGiftOutline, IoCloseOutline } from "react-icons/io5";
import useUser from "@/hooks/useUser";
import useSiteConfig from "@/hooks/useSiteConfig";
import { useGetMyWelcomeQuery } from "./welcomeApi";

const KEY = "qwlee:welcome:dismissed";

export default function WelcomeOffer() {
  const user = useUser();
  const site = useSiteConfig();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setReady(true);
    try { setDismissed(localStorage.getItem(KEY) === "1"); } catch {}
  }, []);
  const { data: mine } = useGetMyWelcomeQuery(undefined, { skip: !user || user.role === "admin" });
  const pct = Number(site?.growth?.welcomePercent || 0);
  if (!ready || dismissed) return null;
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(KEY, "1"); } catch {} };

  let body = null;
  if (!user && pct > 0) {
    body = (
      <>
        <span className="min-w-0">New to Qwlee? <strong>Get {pct}% off your first order</strong> when you sign up.</span>
        <Link href="/sign-up" className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-sm font-semibold">Sign up</Link>
      </>
    );
  } else if (user && mine?.code) {
    const label = mine.type === "percent" ? `${mine.value}% off` : `$${mine.value} off`;
    const copy = async () => {
      try { await navigator.clipboard.writeText(mine.code); toast.success("Code copied"); } catch { toast(mine.code); }
    };
    body = (
      <>
        <span className="min-w-0">
          <strong>{label} your first order</strong> with code{" "}
          <button type="button" onClick={copy} className="font-mono font-semibold underline decoration-dotted" title="Copy code">{mine.code}</button>
          {mine.expiresAt ? <span className="opacity-80"> · until {new Date(mine.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span> : null}
        </span>
        <Link href="/gig" className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-sm font-semibold">Browse</Link>
      </>
    );
  }
  if (!body) return null;
  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="flex items-center gap-3 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm">
        <IoGiftOutline className="text-xl shrink-0" aria-hidden />
        <div className="flex-1 flex flex-wrap items-center justify-between gap-2">{body}</div>
        <button type="button" onClick={dismiss} aria-label="Dismiss offer" className="p-1 rounded hover:bg-white/10 shrink-0">
          <IoCloseOutline />
        </button>
      </div>
    </div>
  );
}
