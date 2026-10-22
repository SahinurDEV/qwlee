import { siteOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function robots() {
  const origin = await siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard", "/order", "/inbox", "/notifications", "/list", "/profile",
          "/earnings", "/support", "/requests/mine", "/requests/new", "/gig/add",
          "/gig/edit", "/success", "/cancel", "/auth/", "/change-password", "/verify-email",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
