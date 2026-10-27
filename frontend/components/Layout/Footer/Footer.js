"use client";
// Qwlee footer — clean, dark, four-column on desktop, stacked on mobile.
// Real links only. The previous footer carried fake phone/address +
// social handles tied to the old brand; both were removed because we
// don't actually have those, and inventing them is worse than not
// showing them. Drop real values in if/when you have them.

import CurrencySelect from "@/components/common/CurrencySelect";
import LanguageSelect from "@/components/common/LanguageSelect";
import ThemeToggle from "@/components/common/ThemeToggle";
import { DARK_MODE } from "@/lib/features";
import { useI18n } from "@/components/Context/I18nProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaXTwitter,
} from "react-icons/fa6";
import { HiOutlineMailOpen } from "react-icons/hi";
import { GoVerified } from "react-icons/go";
import QwleeLogo from "@/components/common/QwleeLogo";
import { base } from "@/lib/constant";
import useUser from "@/hooks/useUser";
import useSiteConfig, { featureOn } from "@/hooks/useSiteConfig";

const MARKETPLACE_BASE = [
  { label: "Explore services", key: "exploreServices", href: "/gig" },
  { label: "Hire freelancers", key: "hireFreelancers", href: "/hire-freelancers" },
  { label: "Browse categories", key: "browseCategories", href: "/services" },
  { label: "Buyer requests", key: "buyerRequests", href: "/requests" },
  { label: "Post a request", key: "postRequest", href: "/requests/new" },
];

const COMPANY = [
  { label: "About us", key: "aboutUs", href: "/about-us" },
  { label: "Help centre", key: "helpCentre", href: "/help" },
  { label: "Contact us", key: "contactUs", href: "/contact-us" },
  { label: "Blog", key: "blog", href: "/blogs" },
];

const LEGAL = [
  { label: "Terms of service", key: "terms", href: "/terms-of-service" },
  { label: "Privacy policy", key: "privacy", href: "/privacy-policy" },
  { label: "Trust & safety", key: "trust", href: "/trust-safety" },
  { label: "Community standards", key: "communityStandards", href: "/community-standards" },
  { label: "Refunds", key: "refundPolicy", href: "/refund-policy" },
  { label: "Payment terms", key: "paymentTerms", href: "/payment-terms" },
  { label: "Intellectual property", key: "ipPolicy", href: "/intellectual-property" },
  { label: "Cookie policy", key: "cookiePolicy", href: "/cookie-policy" },
];

// Social handles intentionally point to placeholder URLs. Replace with
// your real accounts when you have them — until then they're hidden.
const SOCIAL = [
  // { icon: FaXTwitter,    label: "Twitter / X", href: "https://x.com/qwlee" },
  // { icon: FaLinkedinIn,  label: "LinkedIn",    href: "https://www.linkedin.com/company/qwlee" },
  // { icon: FaInstagram,   label: "Instagram",   href: "https://www.instagram.com/qwlee" },
  // { icon: FaFacebookF,   label: "Facebook",    href: "https://www.facebook.com/qwlee" },
];

export default function Footer() {
  const router = useRouter();
  const { t } = useI18n();
  const currentUser = useUser();
  // Auth state in a client effect — SSR doesn't see cookies, so reading
  // useUser() directly at render flips the "Become a seller" label
  // between server and client paint and triggers a hydration warning.
  // Depend on a stable scalar id; useUser() returns a fresh object per
  // render (re-parses the cookie), so depending on the object reference
  // would loop the effect forever.
  const [user, setUser] = useState(null);
  const currentUserId = currentUser?.id || currentUser?._id || null;
  useEffect(() => {
    setUser(currentUser || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);
  const [email, setEmail] = useState("");

  const site = useSiteConfig();
  const MARKETPLACE = [
    ...MARKETPLACE_BASE.filter((l) => featureOn(site, "buyerRequests") || !l.href.startsWith("/requests")),
    user
      ? { label: "Sell on Qwlee", key: "sellOnQwlee", href: "/dashboard" }
      : { label: "Become a seller", key: "becomeSeller", href: "/sign-up" },
  ];

  const [subscribing, setSubscribing] = useState(false);
  async function handleNewsletter(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v) return;
    setSubscribing(true);
    try {
      const res = await fetch(`${base}/v1/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
        body: JSON.stringify({ email: v, source: "footer" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Could not subscribe");
      toast.success("You're subscribed. Thanks!");
      setEmail("");
    } catch (err) {
      toast.error(err.message || "Could not subscribe");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main grid */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-8">
          {/* Brand / pitch / newsletter */}
          <div className="md:col-span-5 pb-8 md:pb-0">
            <Link href="/" aria-label="Qwlee home" className="inline-block">
              <QwleeLogo height={32} variant="white" />
            </Link>
            <p className="mt-4 text-sm text-gray-400 max-w-sm leading-relaxed">
              {t("pitch")}
            </p>

            <form
              onSubmit={handleNewsletter}
              className="mt-5 flex flex-col sm:flex-row gap-2 max-w-sm"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("yourEmail")}
                aria-label="Newsletter email"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {subscribing ? t("subscribing") : t("subscribe")}
              </button>
            </form>

            <div className="mt-5 inline-flex items-center gap-2 text-xs text-gray-400">
              <GoVerified className="text-emerald-400" />
              <span>{t("verifiedEscrow")}</span>
            </div>
          </div>

          {/* Link columns */}
          <FooterColumn title={t("marketplace")} links={MARKETPLACE.map((l) => ({ ...l, label: t(l.key) }))} />
          <FooterColumn title={t("company")} links={COMPANY.map((l) => ({ ...l, label: t(l.key) }))} />
          <FooterColumn title={t("legal")} links={LEGAL.map((l) => ({ ...l, label: t(l.key) }))} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Qwlee. {t("rights")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <LanguageSelect />
            {DARK_MODE && <ThemeToggle />}
            <CurrencySelect />
          </div>

          <div className="flex items-center gap-4">
            <a
              href="mailto:info@qwlee.com"
              className="inline-flex items-center gap-1.5 min-h-[44px] hover:text-gray-200 transition"
            >
              <HiOutlineMailOpen className="w-4 h-4" />
              info@qwlee.com
            </a>

            {SOCIAL.length > 0 && (
              <div className="flex items-center gap-2">
                {SOCIAL.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-800 hover:bg-emerald-600 hover:text-white transition"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

// On phones each column folds into a tap-to-open section so the footer
// isn't a long scroll; from md up all columns are always open. Links stay
// in the DOM either way, so crawlers still see them.
function FooterColumn({ title, links }) {
  const [open, setOpen] = useState(false);
  const id = `footer-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="md:col-span-2 border-b border-gray-800 md:border-0">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider md:mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="md:hidden w-full flex items-center justify-between py-3 uppercase tracking-wider"
        >
          {title}
          <span aria-hidden className={`text-gray-400 text-lg leading-none transition-transform ${open ? "rotate-45" : ""}`}>+</span>
        </button>
        <span className="hidden md:inline">{title}</span>
      </h3>
      <ul id={id} className={`space-y-1 pb-3 md:pb-0 ${open ? "block" : "hidden"} md:block`}>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-block py-1.5 text-sm text-gray-400 hover:text-white transition"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
