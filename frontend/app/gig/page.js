import Gig from "@/components/Gig/Gig";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

// Search / category listing. A single category (optionally with a
// subcategory) is an indexable landing page with its own title and
// canonical; text searches, other filters and later pages are noindex
// so they don't compete with it.
const FILTER_KEYS = ["minPrice", "maxPrice", "delivery", "language", "country", "online", "verifiedOnly", "pro", "minRating", "level", "hasVideo", "sortBy", "page"];

export async function generateMetadata({ searchParams }) {
  const sp = (await searchParams) || {};
  const one = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const cats = one(sp.categories).split(",").map((x) => x.trim()).filter(Boolean);
  const sub = one(sp.subCategory).trim();
  const q = one(sp.title).trim();
  const filtered = FILTER_KEYS.some((k) => one(sp[k]));
  const topic = sub || (cats.length === 1 ? cats[0] : "");
  const title = q ? `“${q.slice(0, 60)}” services` : topic ? `${topic} services` : "Find services";
  const description = q
    ? `Freelance services matching “${q.slice(0, 60)}”. Compare packages, reviews and delivery times on Qwlee.`
    : topic
    ? `Hire freelancers for ${topic.toLowerCase()}. Compare packages, prices, reviews and delivery times on Qwlee.`
    : "Browse freelance services by category. Compare packages, prices, reviews and delivery times on Qwlee.";
  const landing = !q && !filtered && cats.length <= 1;
  const canonical = cats.length === 1
    ? `/gig?categories=${encodeURIComponent(cats[0])}${sub ? `&subCategory=${encodeURIComponent(sub)}` : ""}`
    : "/gig";
  return {
    title,
    description,
    alternates: { canonical },
    robots: landing ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

const page = () => {
  return (
    <PrimaryLayout>
      <Gig />
    </PrimaryLayout>
  );
};

export default page;
