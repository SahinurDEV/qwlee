import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { Providers } from "./redux/provider";
import { Toaster } from "sonner";
import { MdError } from "react-icons/md";
import { SocketProvider } from "@/components/Context/SocketProvider";
import { DARK_MODE } from "@/lib/features";
import { I18nProvider } from "@/components/Context/I18nProvider";
import { LANG_COOKIE, normaliseLang } from "@/lib/i18n";
import MaintenancePage from "@/components/common/MaintenancePage";
import { cookies } from "next/headers";

const BASE_METADATA = {
  title: {
    default: "Qwlee — Modern Freelance Marketplace",
    template: "%s · Qwlee",
  },
  description:
    "Qwlee is a modern freelance marketplace where buyers hire vetted experts in web, mobile, design, video, AI, and more — with cloud-hosted media, escrowed payments, and a transparent review system.",
  applicationName: "Qwlee",
  keywords: [
    "freelance marketplace",
    "hire freelancers",
    "remote work",
    "Qwlee",
    "Next.js developers",
    "UI/UX designers",
  ],
  openGraph: {
    title: "Qwlee — Modern Freelance Marketplace",
    description:
      "Hire vetted freelance experts on Qwlee. From Next.js engineers to brand designers and video editors.",
    siteName: "Qwlee",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qwlee — Modern Freelance Marketplace",
    description:
      "Hire vetted freelance experts on Qwlee. Web, design, video, AI, and more.",
  },
};

// Admin SEO settings (Settings > SEO) override the defaults. The server
// reads them from the API (INTERNAL_API_URL inside Docker), cached 60s;
// if the API is unreachable the defaults above are used.
async function siteSettings() {
  const bases = [process.env.INTERNAL_API_URL, process.env.NEXT_PUBLIC_BACKEND_API_URL].filter(Boolean);
  for (const b of bases) {
    try {
      const r = await fetch(`${b.replace(/\/+$/, "")}/v1/info/site`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2000),
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      if (r.ok) return (await r.json())?.data?.attributes || null;
    } catch {}
  }
  return null;
}

export async function generateMetadata() {
  const s = await siteSettings();
  const name = s?.branding?.siteName || "Qwlee";
  const title = s?.seo?.title;
  const description = s?.seo?.description;
  const image = s?.seo?.ogImage;
  return {
    ...BASE_METADATA,
    applicationName: name,
    title: { default: title || BASE_METADATA.title.default, template: `%s · ${name}` },
    description: description || BASE_METADATA.description,
    openGraph: {
      ...BASE_METADATA.openGraph,
      siteName: name,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      ...BASE_METADATA.twitter,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function RootLayout({ children }) {
  const jar = await cookies();
  const lang = normaliseLang(jar.get(LANG_COOKIE)?.value);
  const dark = DARK_MODE && jar.get("qwlee_theme")?.value === "dark";
  const site = await siteSettings();
  if (site?.maintenance?.enabled) {
    return (
      <html lang={lang}>
        <body>
          <MaintenancePage siteName={site.branding?.siteName} message={site.maintenance.message} until={site.maintenance.until} />
        </body>
      </html>
    );
  }
  return (
    <html lang={lang} className={dark ? "dark" : undefined}>
      <body>
        <I18nProvider lang={lang}>
        <Providers>
          <SocketProvider>
            {/* No Suspense here: it would start streaming before pages
                can call notFound(), turning every 404 into a 200.
                PrimaryLayout carries the boundary instead. */}
            {children}
            <Toaster
            richColors  
              position="top-center"
            />
          </SocketProvider>
        </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
