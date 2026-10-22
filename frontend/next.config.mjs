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
  // Placeholder images currently referenced in source; migrate these to
  // Cloudinary or self-hosted assets and remove these entries.
  // Seed data uses picsum.photos for deterministic placeholder images.
  "picsum.photos",
  "fastly.picsum.photos",
  ...extraHosts,
]);

const nextConfig = {
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
