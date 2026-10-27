// Cookie consent choice. Essential cookies always run; optional only after accept.
export const CONSENT_KEY = "qwlee_cookie_consent";
export const CONSENT_COOKIE = "qwlee_cookie_consent";

export const CONSENT = {
  essential: "essential",
  all: "all",
};

/** @returns {"essential"|"all"|null} */
export function readConsent() {
  if (typeof document === "undefined") return null;
  try {
    const fromLs = localStorage.getItem(CONSENT_KEY);
    if (fromLs === CONSENT.essential || fromLs === CONSENT.all) return fromLs;
  } catch {}
  const m = document.cookie.match(/(?:^|; )qwlee_cookie_consent=([^;]*)/);
  if (!m) return null;
  try {
    const v = decodeURIComponent(m[1]);
    if (v === CONSENT.essential || v === CONSENT.all) return v;
  } catch {}
  return null;
}

export function writeConsent(value) {
  if (value !== CONSENT.essential && value !== CONSENT.all) return;
  try { localStorage.setItem(CONSENT_KEY, value); } catch {}
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
  try {
    window.dispatchEvent(new CustomEvent("qwlee-cookie-consent", { detail: value }));
  } catch {}
}

export function optionalAllowed(consent = readConsent()) {
  return consent === CONSENT.all;
}
