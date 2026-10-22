"use client";
// IP-based location detection. Mirrors how Fiverr auto-fills country on
// sign-up — no typed input, just "We see you're in <city, country>".
//
// Asks our API (/v1/info/geo, which looks the IP up server-side) once and
// caches the result in sessionStorage so the second page load is instant
// and doesn't re-burn the per-IP quota. The hook never throws — if the
// lookup fails the consumer gets { country: null, ... } and can still
// fall back to the user typing a location later via profile edit.
//
//   const { loading, country, countryCode, city, region, locationLabel } =
//     useIpLocation();

import { useEffect, useState } from "react";
import { base } from "@/lib/constant";

const KEY = "qwlee:iploc";
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function readCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* storage disabled — fine */
  }
}

// Map a country code to a flag emoji using regional indicator symbols.
// "US" → 🇺🇸. Returns an empty string for invalid codes.
export function flagEmoji(code) {
  if (!code || typeof code !== "string" || code.length !== 2) return "";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export default function useIpLocation() {
  const [state, setState] = useState({
    loading: true,
    country: null,
    countryCode: null,
    city: null,
    region: null,
    ip: null,
    error: null,
  });

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setState({ loading: false, error: null, ...cached });
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        // Looked up by our API (server-side) — see backend geo.service.
        const res = await fetch(`${base}/v1/info/geo`, {
          signal: ctrl.signal,
          headers: { "ngrok-skip-browser-warning": "1" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json())?.data?.attributes || {};
        if (!json.countryCode) throw new Error("Unknown location");
        const data = {
          country: json.country || null,
          countryCode: json.countryCode || null,
          city: json.city || null,
          region: json.region || null,
          ip: null,
        };
        writeCache(data);
        setState({ loading: false, error: null, ...data });
      } catch (err) {
        if (err?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: err?.message || "Lookup failed" }));
      }
    })();
    return () => ctrl.abort();
  }, []);

  const locationLabel = (() => {
    const parts = [state.city, state.country].filter(Boolean);
    return parts.join(", ");
  })();

  return { ...state, locationLabel };
}
