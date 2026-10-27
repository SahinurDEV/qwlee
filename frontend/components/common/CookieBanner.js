"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT, readConsent, writeConsent } from "@/lib/cookieConsent";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readConsent() == null);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    writeConsent(value);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] sm:p-4"
    >
      <div className="mx-auto max-w-3xl border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-3 py-2.5 sm:rounded-2xl sm:border sm:shadow-lg sm:p-5 sm:flex sm:items-center sm:gap-4">
        <p className="text-xs sm:text-sm text-gray-800 leading-snug sm:leading-relaxed sm:flex-1">
          <span className="sm:hidden">
            We use essential cookies to run the site.{" "}
            <Link href="/cookie-policy" className="text-emerald-700 underline underline-offset-2">
              Learn more
            </Link>
          </span>
          <span className="hidden sm:inline">
            We use <strong>essential</strong> cookies to keep you signed in and the site secure.
            Optional cookies help us understand usage. See the{" "}
            <Link href="/cookie-policy" className="text-emerald-700 underline underline-offset-2">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="text-emerald-700 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={() => choose(CONSENT.essential)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 min-h-[44px]"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose(CONSENT.all)}
            className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 min-h-[44px]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
