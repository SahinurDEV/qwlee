/** @type {import('next').NextConfig} */

// Build the image allowlist from env so dev/staging/prod stay consistent.
// NEXT_PUBLIC_BACKEND_API_URL drives the backend host; Cloudinary is the
// other expected source. To add more, set NEXT_PUBLIC_IMAGE_HOSTS as a
// comma-separated list of hostnames.
const extraHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:7171";
let backendHost = "localhost";
try {
  backendHost = new URL(backendUrl).hostname;
} catch {
  // fall back to default
}

const hosts = new Set([
  backendHost,
  "res.cloudinary.com",
  "lh3.googleusercontent.com",
  // User uploads are stored on ImgBB.
  "i.ibb.co",
  "i.ibb.co.com",
  // Placeholder images currently referenced in source; migrate these to
  // Cloudinary or self-hosted assets and remove these entries.
  // Seed data uses picsum.photos for deterministic placeholder images.
  "picsum.photos",
  "fastly.picsum.photos",
  ...extraHosts,
]);

// Security headers for every page. The API has helmet; the site needs its
// own. CSP stays permissive on scripts (Next inlines its bootstrap and
// Stripe/Google need their hosts) but blocks framing, plugins and
// base-tag hijacking. Set CSP_REPORT_ONLY=true to only report.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: http: wss: ws:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://www.youtube.com https://player.vimeo.com",
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'none'",
].join("; ");
const securityHeaders = [
  { key: process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // The built-in optimizer fetches every remote image server-side. That
    // breaks behind proxies / split DNS (and is an SSRF surface), so by
    // default images are served as-is. Set NEXT_IMAGE_OPTIMIZE=true at
    // build time to enable it.
    unoptimized: process.env.NEXT_IMAGE_OPTIMIZE !== "true",
    remotePatterns: [...hosts].map((hostname) => ({ hostname })),
  },
};

export default nextConfig;
