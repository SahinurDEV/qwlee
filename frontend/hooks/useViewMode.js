"use client";
// Fiverr-style "Switch to Selling / Switch to Buying" mode.
//
// One Qwlee account can act in either mode. The active mode lives in
// localStorage so it survives page reloads, and is broadcast across
// components via a window event so the navbar, drawer, and dashboard
// stay in sync without prop-drilling or extra Redux state.
//
// Default mode is derived from the user's backend role:
//   freelancer → "selling"
//   buyer      → "buying"
// Once the user toggles manually, their choice wins on subsequent visits.

import { useCallback, useEffect, useState } from "react";

const KEY = "qwlee:viewMode";
const EVT = "qwlee:viewMode:changed";

export const SELLING = "selling";
export const BUYING = "buying";

function defaultFromRole(role) {
  return role === "buyer" ? BUYING : SELLING;
}

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === SELLING || v === BUYING ? v : null;
  } catch {
    return null;
  }
}

export default function useViewMode(user) {
  // SSR-safe: start with the role-derived default. After mount, hydrate
  // from localStorage so a user who toggled previously keeps their choice.
  // `null` until we know who is signed in, so pages don't fire seller (or
  // buyer) API calls for the wrong account during the first render.
  const [mode, setMode] = useState(null);

  useEffect(() => {
    if (!user?.role) return;
    const stored = readStored();
    setMode(stored || defaultFromRole(user.role));
  }, [user?.role]);

  useEffect(() => {
    function onChange(e) {
      if (e?.detail === SELLING || e?.detail === BUYING) setMode(e.detail);
    }
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const setViewMode = useCallback((next) => {
    if (next !== SELLING && next !== BUYING) return;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage disabled — still broadcast in-memory change */
    }
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode(mode === SELLING ? BUYING : SELLING);
  }, [mode, setViewMode]);

  return { mode, ready: mode !== null, isSelling: mode === SELLING, isBuying: mode === BUYING, setViewMode, toggleViewMode };
}

export function clearViewMode() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
