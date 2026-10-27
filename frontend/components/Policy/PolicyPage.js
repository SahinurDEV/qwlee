"use client";
// Shared layout for policy pages: title, last-updated line, a short
// contents list and numbered sections. Numbers that the admin can change
// (fees, clearance, review window...) come from the public site config.
import Link from "next/link";
import useSiteConfig from "@/hooks/useSiteConfig";

export const POLICY_DEFAULTS = {
  buyerFeePercent: 5.5,
  smallOrderFee: 3.5,
  smallOrderUnder: 200,
  clearanceDays: 14,
  clearanceDaysFast: 7,
  autoCompleteDays: 3,
  withdrawMin: { bank: 20, paypal: 1, payoneer: 10 },
  withdrawMax: 10000,
  payoutChangeHoldHours: 24,
  reviewWindowDays: 14,
  warningExpiryDays: 90,
};

export function usePolicy() {
  const site = useSiteConfig();
  return { ...POLICY_DEFAULTS, ...(site?.policy || {}), commissionPercent: site?.policy?.commissionPercent };
}

export default function PolicyPage({ title, updated, intro, sections, related = [] }) {
  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
      <article className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {updated}</p>
        {intro ? <p className="mt-4 text-gray-700 leading-relaxed">{intro}</p> : null}
        <nav aria-label="Contents" className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Contents</div>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {sections.map((s, i) => (
              <li key={i}><a href={`#s${i + 1}`} className="text-emerald-700 hover:underline">{s.heading}</a></li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section key={i} id={`s${i + 1}`} className="mt-8 scroll-mt-24">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">{i + 1}. {s.heading}</h2>
            {(s.body || []).map((p, j) => <p key={j} className="mt-3 text-gray-700 leading-relaxed">{p}</p>)}
            {s.list ? (
              <ul className="mt-3 list-disc pl-5 space-y-1.5 text-gray-700">
                {s.list.map((x, j) => <li key={j}>{x}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
        {related.length ? (
          <div className="mt-10 border-t border-gray-200 pt-6 text-sm">
            <div className="font-semibold text-gray-900 mb-2">Related policies</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {related.map((r) => <Link key={r.href} href={r.href} className="text-emerald-700 hover:underline">{r.label}</Link>)}
            </div>
          </div>
        ) : null}
      </article>
    </main>
  );
}

export const RELATED = [
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Community Standards", href: "/community-standards" },
  { label: "Refunds & cancellations", href: "/refund-policy" },
  { label: "Payment terms", href: "/payment-terms" },
  { label: "Intellectual property", href: "/intellectual-property" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];
