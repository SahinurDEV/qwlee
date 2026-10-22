import { apiGet, siteOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

const STATIC = ["", "/gig", "/services", "/hire-freelancers", "/requests", "/blogs",
  "/about-us", "/contact-us", "/privacy-policy", "/terms-of-service", "/trust-safety"];

export default async function sitemap() {
  const origin = await siteOrigin();
  const now = new Date();
  const out = STATIC.map((p) => ({ url: `${origin}${p}`, lastModified: now, changeFrequency: "daily", priority: p ? 0.7 : 1 }));
  const gigs = await apiGet("/gig?limit=1000&page=1", { revalidate: 600 });
  const sellers = new Set();
  for (const g of gigs.data?.results || []) {
    if (g.slug) out.push({ url: `${origin}/gig/${g.slug}`, lastModified: g.updatedAt ? new Date(g.updatedAt) : now, changeFrequency: "weekly", priority: 0.8 });
    const u = g.userId?.username || g.user?.username;
    if (u) sellers.add(u);
  }
  for (const u of sellers) out.push({ url: `${origin}/${u}`, changeFrequency: "weekly", priority: 0.5 });
  const blogs = await apiGet("/blog?limit=500", { revalidate: 600 });
  for (const b of blogs.data?.results || []) {
    if (b.slug) out.push({ url: `${origin}/blogs/${b.slug}`, lastModified: b.updatedAt ? new Date(b.updatedAt) : now, priority: 0.4 });
  }
  return out;
}
