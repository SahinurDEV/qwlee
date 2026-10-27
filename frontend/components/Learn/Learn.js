"use client";
// /learn: curated learning paths for buyers and sellers (Qwlee Learn).
import Link from "next/link";
import { useGetAllBlogsQuery } from "@/app/redux/features/getAllBlogs";
import {
  IoSchoolOutline,
  IoCartOutline,
  IoStorefrontOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoChevronForward,
} from "react-icons/io5";

const PATHS = [
  {
    id: "buy",
    title: "Buy with confidence",
    icon: IoCartOutline,
    blurb: "Find the right seller, brief the work, and use escrow from day one.",
    steps: [
      { href: "/help/what-is-qwlee", label: "What is Qwlee?" },
      { href: "/help/how-does-escrow-protect-me", label: "How escrow protects you" },
      { href: "/briefs", label: "Write a project brief" },
      { href: "/gig", label: "Browse services" },
      { href: "/help/how-do-i-cancel-an-order", label: "Cancel or resolve an order" },
    ],
  },
  {
    id: "sell",
    title: "Sell and grow",
    icon: IoStorefrontOutline,
    blurb: "Publish a strong gig, climb levels, and keep buyers coming back.",
    steps: [
      { href: "/help/how-do-i-create-a-great-gig", label: "Create a great gig" },
      { href: "/gig/add", label: "Open the gig wizard" },
      { href: "/help/how-do-seller-levels-work", label: "Seller levels explained" },
      { href: "/seller-plan", label: "Seller Plus plans" },
      { href: "/help/when-can-i-withdraw-my-earnings", label: "Withdraw earnings" },
    ],
  },
  {
    id: "safe",
    title: "Stay safe",
    icon: IoShieldCheckmarkOutline,
    blurb: "Lock down your account and know what happens when work goes sideways.",
    steps: [
      { href: "/help/how-do-i-turn-on-two-factor-sign-in", label: "Turn on two-factor" },
      { href: "/help/how-do-i-sign-out-of-other-devices", label: "Sign out other devices" },
      { href: "/help/what-happens-if-an-order-is-late", label: "Late order rules" },
      { href: "/resolution", label: "Resolution Center" },
      { href: "/community-standards", label: "Community standards" },
    ],
  },
  {
    id: "pro",
    title: "Go further",
    icon: IoSparklesOutline,
    blurb: "Teams, Pro talent, AI workspace and more power tools.",
    steps: [
      { href: "/pro", label: "Qwlee Pro" },
      { href: "/teams", label: "Teams for buyers" },
      { href: "/ai-assistant", label: "AI workspace" },
      { href: "/talent", label: "Find talent" },
      { href: "/subscriptions", label: "Monthly subscriptions" },
    ],
  },
];

export default function Learn() {
  const { data } = useGetAllBlogsQuery("guide");
  const guides = data?.data?.attributes?.results || [];

  return (
    <main className="bg-gray-50/50 min-h-screen" data-testid="learn-hub">
      <section className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white">
        <div className="container mx-auto px-4 py-14 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <IoSchoolOutline /> Qwlee Learn
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Learn how to buy and sell on Qwlee</h1>
          <p className="mt-3 text-emerald-50/90 max-w-2xl">
            Short paths that mix help articles with the real product screens. Pick a track and work through it at your pace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/help" className="rounded-lg bg-white px-4 py-2 font-medium text-emerald-900 hover:bg-emerald-50">
              Help centre
            </Link>
            <Link href="/blogs?kind=guide" className="rounded-lg border border-white/40 px-4 py-2 font-medium hover:bg-white/10">
              All guides
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        <div className="grid md:grid-cols-2 gap-5">
          {PATHS.map((p) => {
            const Icon = p.icon;
            return (
              <section key={p.id} className="rounded-2xl border border-gray-200 bg-white p-6" data-testid={`learn-path-${p.id}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{p.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{p.blurb}</p>
                  </div>
                </div>
                <ol className="mt-4 space-y-1">
                  {p.steps.map((s, i) => (
                    <li key={s.href}>
                      <Link
                        href={s.href}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-800 hover:bg-emerald-50 hover:text-emerald-900"
                      >
                        <span className="w-5 text-xs font-semibold text-gray-400 tabular-nums">{i + 1}</span>
                        <span className="flex-1">{s.label}</span>
                        <IoChevronForward className="text-gray-400" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        {guides.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Latest guides</h2>
              <Link href="/blogs?kind=guide" className="text-sm text-emerald-700 font-medium hover:underline">
                See all →
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 gap-3">
              {guides.slice(0, 6).map((g) => (
                <li key={g.id || g._id}>
                  <Link
                    href={`/blogs/${g.slug || g.id || g._id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-emerald-300"
                  >
                    <div className="font-medium text-gray-900 line-clamp-2">{g.title}</div>
                    {g.excerpt ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{g.excerpt}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
