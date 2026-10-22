"use client";
// Marketplace hero.
//
// Background strategy:
// - Mobile: static gradient + soft blobs (kept lightweight on small
//   screens / mobile data).
// - Desktop (md+): the same gradient PLUS three slow-drifting blurred
//   blobs animated via CSS keyframes. Pure CSS — no video assets, no
//   extra deps. Respects prefers-reduced-motion (animations disabled).
//
// If you want to swap in a real self-hosted hero video later, drop the
// file in `frontend/public/hero.mp4` and add a <video> behind everything.
// Don't hotlink third-party CDN videos — they're copyrighted assets.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoVerified } from "react-icons/go";
import { HiOutlineLockClosed, HiOutlineLightningBolt } from "react-icons/hi";
import SearchSuggestions from "@/components/Search/SearchSuggestions";
import { base } from "@/lib/constant";
import trackSearch from "@/utils/trackSearch";
import useUser from "@/hooks/useUser";
import useSiteConfig from "@/hooks/useSiteConfig";

const ROTATING_SUGGESTIONS = [
  "Next.js developer",
  "Logo designer",
  "Video editor",
  "SEO audit",
  "Claude API integration",
  "React Native app",
  "Landing page copywriter",
  "Brand identity",
];

// Fallback chips when no live trending data exists yet (fresh DB).
// Capped at 6 to match the live-data display.
const FALLBACK_TRENDING = [
  "Next.js",
  "UI/UX",
  "React Native",
  "SEO",
  "Video editing",
  "AI",
];


export default function HeroQwlee() {
  const site = useSiteConfig();
  const router = useRouter();
  // Read auth state in a client-only effect so SSR + first client paint
  // match (cookies aren't visible during SSR). useUser() parses the
  // cookie afresh on each call → new object identity per render, so we
  // depend on a stable scalar (id) rather than the object reference,
  // otherwise the effect would set state → rerender → set state forever.
  const [user, setUser] = useState(null);
  const currentUser = useUser();
  const currentUserId = currentUser?.id || currentUser?._id || null;
  useEffect(() => {
    setUser(currentUser || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);
  const [trending, setTrending] = useState(FALLBACK_TRENDING);

  // Pull live trending from the search log. Falls back to the seeded
  // list when the endpoint is empty (fresh DB / no traffic yet) so the
  // strip never renders blank.
  //
  // We over-fetch (limit=20) and then keep only queries that have been
  // searched more than once — a single search isn't a trend, it's just
  // noise. Final cap is 6 chips so the strip stays scannable.
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/v1/search/trending?days=7&limit=20`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const popular = (res?.data?.attributes?.results || [])
          .filter((r) => (Number(r.count) || 0) >= 2)
          .map((r) => r.query)
          .filter(Boolean)
          .slice(0, 6);
        if (popular.length) setTrending(popular);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function searchTerm(term) {
    trackSearch(term, { route: "/gig" });
    router.push(`/gig?title=${encodeURIComponent(term)}`);
  }

  return (
    // NOTE: section is overflow-VISIBLE so the search dropdown can
    // extend past the hero's bottom edge. The blurred decorative blobs
    // get their own clipping layer below so they can't bleed out of
    // the hero — separation of concerns: backdrop is clipped, content
    // is free.
    <section className="relative bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
      {/* Backdrop clip layer — overflow-hidden lives ONLY here so the
          decorative blobs stay inside the hero while the content
          layer (including the search dropdown) is unclipped. */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden pointer-events-none"
      >
        <div className="hidden md:block absolute inset-0">
          <div className="qwlee-blob qwlee-blob-a" />
          <div className="qwlee-blob qwlee-blob-b" />
          <div className="qwlee-blob qwlee-blob-c" />
        </div>
        <div className="md:hidden absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="md:hidden absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-14 md:py-24 max-w-5xl">
        <div className="text-center">
          {/* Pure-CSS entrance animations. Every element below uses the
              `qwlee-rise` class with a staggered `animationDelay`. CSS
              keyframes ALWAYS replay on mount and `animation-fill-mode:
              both` makes the final state stick — bulletproof across
              every Next.js navigation case (route-cache, back/forward,
              hard nav). Snappy 0.4s, custom-curve ease for a polished
              feel. */}
          <span
            className="qwlee-rise inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-emerald-100 text-emerald-700 text-xs font-medium"
            style={{ animationDelay: "40ms" }}
          >
            <GoVerified /> Trusted freelancers · verified payouts
          </span>
          <h1
            className="qwlee-rise mt-4 md:mt-5 text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-gray-900"
            style={{ animationDelay: "100ms" }}
          >
            {site?.homepage?.heroTitle ? (
              site.homepage.heroTitle
            ) : (
              <>
                Find the right freelancer{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                  for any project
                </span>
              </>
            )}
          </h1>
          <p
            className="qwlee-rise mt-3 md:mt-4 text-sm md:text-lg text-gray-600 max-w-2xl mx-auto"
            style={{ animationDelay: "160ms" }}
          >
            {site?.homepage?.heroSubtitle ||
              "Web, design, video, AI, and more — hire from a global marketplace of vetted professionals."}
          </p>

          {/* Search wrapper intentionally uses qwlee-fade (opacity only)
              instead of qwlee-rise (translate + opacity). A `transform`
              creates a new CSS stacking context which would trap the
              absolutely-positioned suggestion dropdown's z-index inside
              this wrapper, making it appear behind other page chrome
              after the animation completes. Opacity-only entrance keeps
              the dropdown free to stack over everything. */}
          <div
            className="qwlee-fade mt-6 md:mt-8 mx-auto max-w-2xl text-left relative z-30"
            style={{ animationDelay: "220ms" }}
          >
            <SearchSuggestions
              size="lg"
              rotatingPlaceholders={ROTATING_SUGGESTIONS}
            />
          </div>

          <div
            className="qwlee-rise mt-4 md:mt-5 flex flex-wrap items-center justify-center gap-1.5 md:gap-2"
            style={{ animationDelay: "280ms" }}
          >
            <span className="text-xs md:text-sm text-gray-500">Trending:</span>
            {trending.map((t, i) => (
              <button
                key={t}
                onClick={() => searchTerm(t)}
                className="qwlee-pop px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-gray-200 bg-white text-xs md:text-sm text-gray-700 hover:border-emerald-500 hover:text-emerald-700 hover:-translate-y-0.5 transition"
                style={{ animationDelay: `${340 + i * 35}ms` }}
              >
                {t}
              </button>
            ))}
          </div>

          <div
            className="qwlee-rise mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-left"
            style={{ animationDelay: "420ms" }}
          >
            <TrustCard
              icon={<HiOutlineLockClosed className="w-5 h-5" />}
              title="Secure payments"
              body="Funds held in escrow until you accept delivery."
            />
            <TrustCard
              icon={<GoVerified className="w-5 h-5" />}
              title="Verified sellers"
              body="Identity-checked freelancers with verified reviews."
            />
            <TrustCard
              icon={<HiOutlineLightningBolt className="w-5 h-5" />}
              title="Fast delivery"
              body="Most orders ship in days, not weeks."
            />
          </div>

          {!user && (
            <p
              className="qwlee-rise mt-6 md:mt-8 text-sm text-gray-500"
              style={{ animationDelay: "500ms" }}
            >
              New to Qwlee?{" "}
              <Link href="/sign-up" className="text-emerald-700 font-medium">
                Create your free account
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Scoped keyframes for the animated background. Lives in the
          component so it ships with it. */}
      <style jsx>{`
        .qwlee-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(72px);
          opacity: 0.55;
          will-change: transform;
        }
        .qwlee-blob-a {
          width: 28rem;
          height: 28rem;
          top: -8rem;
          right: -6rem;
          background: radial-gradient(circle, #6ee7b7 0%, #34d399 70%);
          animation: qwlee-drift-a 22s ease-in-out infinite;
        }
        .qwlee-blob-b {
          width: 30rem;
          height: 30rem;
          bottom: -10rem;
          left: -8rem;
          background: radial-gradient(circle, #67e8f9 0%, #22d3ee 70%);
          animation: qwlee-drift-b 28s ease-in-out infinite;
        }
        .qwlee-blob-c {
          width: 22rem;
          height: 22rem;
          top: 40%;
          left: 45%;
          background: radial-gradient(circle, #a7f3d0 0%, #6ee7b7 70%);
          opacity: 0.35;
          animation: qwlee-drift-c 32s ease-in-out infinite;
        }
        @keyframes qwlee-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-3rem, 2rem) scale(1.05); }
        }
        @keyframes qwlee-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(2rem, -2rem) scale(1.08); }
        }
        @keyframes qwlee-drift-c {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-46%, -54%) scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qwlee-blob { animation: none !important; }
          .qwlee-rise, .qwlee-pop, .qwlee-fade {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }

        /* Hero entrance animations.
           animation-fill-mode both makes the from-state apply BEFORE
           the animation starts (no flash of un-styled content) AND
           keeps the to-state AFTER it ends. The combination is what
           makes CSS keyframes bulletproof on Next.js route restores
           since CSS animations always replay on a fresh element mount
           and the final state is preserved regardless. */
        .qwlee-rise {
          opacity: 0;
          transform: translateY(16px);
          animation: qwlee-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes qwlee-rise {
          to { opacity: 1; transform: translateY(0); }
        }

        /* Opacity-only fade for elements that contain absolutely-
           positioned dropdowns. Avoids the transform-induced stacking
           context that qwlee-rise creates. */
        .qwlee-fade {
          opacity: 0;
          animation: qwlee-fade 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes qwlee-fade {
          to { opacity: 1; }
        }

        .qwlee-pop {
          opacity: 0;
          transform: translateY(8px) scale(0.94);
          animation: qwlee-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes qwlee-pop {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Card lift on hover — same effect framer-motion was doing,
           but a pure CSS transition with no extra JS overhead. */
        :global(.qwlee-trust-card) {
          transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                      border-color 0.2s, box-shadow 0.2s;
        }
        :global(.qwlee-trust-card:hover) {
          transform: translateY(-3px);
        }
      `}</style>
    </section>
  );
}

function TrustCard({ icon, title, body }) {
  return (
    <div className="qwlee-trust-card bg-white/80 backdrop-blur rounded-xl border border-gray-100 p-4 flex items-start gap-3 hover:border-emerald-200 hover:shadow-sm">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{body}</div>
      </div>
    </div>
  );
}
