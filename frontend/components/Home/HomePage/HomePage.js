"use client";
import Link from "next/link";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import HeroQwlee from "@/components/Home/HeroQwlee/HeroQwlee";
import MarketplaceStats from "@/components/Home/HeroSection/MarketplaceStats";
import RecentlyViewedGigs from "@/components/Home/RecentlyViewed/RecentlyViewedGigs";
import RecommendedGigs from "@/components/Home/Recommended/RecommendedGigs";
import JoinCNNCTR from "@/components/Home/JoinCNNCTR/JoinCNNCTR";
import MostPopularCategories from "@/components/Home/MostPopularCategories/MostPopularCategories";
import MostPopularFreelancers from "@/components/Home/MostPopularFreelancers/MostPopularFreelancers";
import Testimonials from "@/components/Home/Testimonials/Testimonials";
import TheLatestNewsAndBlog from "@/components/Home/TheLatestNewsAndBlog/TheLatestNewsAndBlog";
import HowItWorks from "@/components/Home/HowItWorks/HowItWorks";
import WhyChooseUs from "@/components/Home/WhyChooseUs/WhyChooseUs";
import Reveal from "@/components/common/Reveal";

const SECTIONS = {
  stats: MarketplaceStats,
  recentlyViewed: RecentlyViewedGigs, // renders nothing for first-time visitors
  recommended: RecommendedGigs,
  categories: MostPopularCategories,
  howItWorks: HowItWorks,
  freelancers: MostPopularFreelancers,
  whyUs: WhyChooseUs,
  testimonials: Testimonials,
  join: JoinCNNCTR,
  blog: TheLatestNewsAndBlog,
};
const DEFAULT_ORDER = Object.keys(SECTIONS).map((key) => ({ key, enabled: true }));

const TONES = {
  light: "bg-white border border-gray-200 text-gray-900",
  brand: "bg-emerald-600 text-white",
  dark: "bg-gray-900 text-white",
};

// Admin-written text block (Site settings → Homepage).
function CustomBlock({ block }) {
  const tone = TONES[block.tone] || TONES.light;
  const external = /^https?:\/\//.test(block.ctaLink || "");
  return (
    <section className="container mx-auto px-4 my-10" data-block={block.id}>
      <div className={`rounded-2xl p-8 md:p-10 ${tone}`}>
        {block.title ? <h2 className="text-2xl md:text-3xl font-bold">{block.title}</h2> : null}
        {block.text ? <p className={`mt-3 max-w-2xl whitespace-pre-line ${block.tone === "light" ? "text-gray-600" : "opacity-90"}`}>{block.text}</p> : null}
        {block.ctaLabel && block.ctaLink ? (
          external ? (
            <a href={block.ctaLink} rel="noopener noreferrer" className={`inline-block mt-5 px-5 py-2.5 rounded-lg font-medium ${block.tone === "light" ? "bg-emerald-600 text-white" : "bg-white text-gray-900"}`}>{block.ctaLabel}</a>
          ) : (
            <Link href={block.ctaLink} className={`inline-block mt-5 px-5 py-2.5 rounded-lg font-medium ${block.tone === "light" ? "bg-emerald-600 text-white" : "bg-white text-gray-900"}`}>{block.ctaLabel}</Link>
          )
        ) : null}
      </div>
    </section>
  );
}

// The hero is always first; the rest follow the admin's homepage layout
// (order + visibility), which the server page passes in so the first
// paint is already in the right order.
export default function HomePage({ layout }) {
  const sections = layout?.sections?.length ? layout.sections : DEFAULT_ORDER;
  const blocks = Object.fromEntries((layout?.blocks || []).map((b) => [b.id, b]));
  return (
    <PrimaryLayout>
      <main>
        <HeroQwlee />
        {sections
          .filter((s) => s.enabled)
          .map(({ key }) => {
            if (blocks[key]) return <Reveal key={key}><CustomBlock block={blocks[key]} /></Reveal>;
            const C = SECTIONS[key];
            return C ? <Reveal key={key}><C /></Reveal> : null;
          })}
      </main>
    </PrimaryLayout>
  );
}
