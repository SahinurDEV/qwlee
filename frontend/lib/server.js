// Server-only helpers: talk to the backend over the internal network when
// INTERNAL_API_URL is set (Docker), otherwise via the public API URL.
import { headers } from "next/headers";
import { base } from "@/lib/constant";

export const serverBase = (process.env.INTERNAL_API_URL || base).replace(/\/+$/, "");

export async function apiGet(path, { revalidate = 0, timeout = 4000 } = {}) {
  try {
    const res = await fetch(`${serverBase}/v1${path}`, {
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
      signal: AbortSignal.timeout(timeout),
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    return { ok: true, data: json?.data?.attributes };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Public origin of this site, from the incoming request.
export async function siteOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:8000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}
