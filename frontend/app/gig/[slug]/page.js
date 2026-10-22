// Server component: looks the gig up first so a missing gig returns a
// real 404, and the metadata carries canonical + share image.
import { notFound } from "next/navigation";
import GigDetails from "@/components/Gig/GigDetails/GigDetails";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import { apiGet } from "@/lib/server";

async function loadGig(slug) {
  const r = await apiGet(`/gig?slug=${encodeURIComponent(slug)}`);
  if (!r.ok) return { gig: null, failed: true };
  return { gig: r.data?.results?.[0] || null, failed: false };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { gig } = await loadGig(slug);
  if (!gig) return { title: "Gig not found", robots: { index: false } };
  const title = gig.title;
  const description = String(gig.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "View this gig on Qwlee.";
  const images = gig.images?.[0] ? [{ url: gig.images[0] }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/gig/${gig.slug || slug}` },
    openGraph: { title, description, type: "website", ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images } : {}) },
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const { gig, failed } = await loadGig(slug);
  // 404 only when the slug doesn't exist at all. A gig that exists but
  // isn't public (pending/paused) still renders so its owner can preview
  // it; if the API is unreachable, let the client component try.
  if (!gig && !failed) {
    const ex = await apiGet(`/gig/slug-exists?slug=${encodeURIComponent(slug)}`);
    if (ex.ok && ex.data?.exists === false) notFound();
  }
  const jsonLd = gig
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: gig.title,
        image: gig.images?.slice(0, 3),
        offers: { "@type": "Offer", priceCurrency: "USD", price: gig.price },
        ...(gig.rating && gig.reviewsCount
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: gig.rating, reviewCount: gig.reviewsCount } }
          : {}),
      }
    : null;
  return (
    <PrimaryLayout>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      ) : null}
      <GigDetails slug={slug} />
    </PrimaryLayout>
  );
}
