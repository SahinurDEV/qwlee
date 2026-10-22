import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { Providers } from "./redux/provider";
import { Toaster } from "sonner";
import { MdError } from "react-icons/md";
import { SocketProvider } from "@/components/Context/SocketProvider";

export const metadata = {
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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SocketProvider>
            {/* Suspense boundary lets client components that call
                useSearchParams() build for production (next build). */}
            <Suspense fallback={null}>{children}</Suspense>
            <Toaster
            richColors  
              position="top-center"
            />
          </SocketProvider>
        </Providers>
      </body>
    </html>
  );
}
