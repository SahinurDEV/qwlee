// Server-side IP → country lookup for the sign-up form. The browser can't
// call ipapi.co itself (CORS + it leaks the visitor to a third party from
// the page). Order of preference:
//   1. a country header set by the CDN/proxy (CF-IPCountry, X-Country-Code)
//   2. GEOIP_URL lookup (default https://ipapi.co/{ip}/json/), cached 6 h
//   3. nothing — the form lets the user pick a country later.
// GEOIP_URL="" disables the external lookup entirely.
const cache = new Map();
const TTL = 6 * 3600 * 1000;

function isPrivate(ip) {
  return (
    !ip ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/i.test(ip)
  );
}

let regionNames;
function countryName(code) {
  try {
    regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

async function lookup(req) {
  const hdr = req.get("cf-ipcountry") || req.get("x-country-code");
  if (hdr && /^[A-Z]{2}$/i.test(hdr) && hdr.toUpperCase() !== "XX") {
    const cc = hdr.toUpperCase();
    return { country: countryName(cc), countryCode: cc, city: null, region: null };
  }
  const ip = String(req.ip || "").replace(/^::ffff:/, "");
  const tpl = process.env.GEOIP_URL === undefined ? "https://ipapi.co/{ip}/json/" : process.env.GEOIP_URL;
  if (!tpl || isPrivate(ip)) return null;
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const res = await fetch(tpl.replace("{ip}", encodeURIComponent(ip)), {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "qwlee-geo/1.0" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const cc = j.country_code || j.countryCode || null;
    const data = cc
      ? { country: j.country_name || j.country || countryName(cc), countryCode: cc, city: j.city || null, region: j.region || j.regionName || null }
      : null;
    if (cache.size > 5000) cache.clear();
    cache.set(ip, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

module.exports = { lookup, isPrivate };
