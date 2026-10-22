"use client";
// Public site settings set by admins (branding, homepage, SEO, feature
// toggles). Fetched once per page load and shared between components.
import { useEffect, useState } from "react";
import { baseUrl } from "@/lib/constant";

let cache = null;
let inflight = null;
const DEFAULTS = { features: { signups: true, buyerRequests: true, tips: true, googleLogin: true }, homepage: { announcement: {} }, branding: {} };

export function loadSiteConfig() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(`${baseUrl}/info/site`, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (cache = j?.data?.attributes || DEFAULTS))
      .catch(() => (cache = DEFAULTS));
  }
  return inflight;
}

export default function useSiteConfig() {
  const [cfg, setCfg] = useState(cache);
  useEffect(() => {
    let alive = true;
    loadSiteConfig().then((c) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}

export const featureOn = (cfg, name) => cfg?.features?.[name] !== false;
