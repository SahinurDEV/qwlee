"use client";
// The language comes from the qwlee_lang cookie, read by the root layout on
// the server, so server and browser render the same text (no hydration
// mismatch). Changing it sets the cookie and refreshes the page.
import { createContext, useContext } from "react";
import { LANG_COOKIE, normaliseLang, translate } from "@/lib/i18n";

const Ctx = createContext("en");

export function I18nProvider({ lang, children }) {
  return <Ctx.Provider value={normaliseLang(lang)}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const lang = useContext(Ctx);
  return { lang, t: (key) => translate(lang, key) };
}

export function setLanguage(lang) {
  document.cookie = `${LANG_COOKIE}=${normaliseLang(lang)}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
