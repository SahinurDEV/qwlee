"use client";
// Light / dark switch. The choice lives in the qwlee_theme cookie so the
// root layout renders <html class="dark"> on the server (no flash).
import { useEffect, useState } from "react";
import { IoMoonOutline, IoSunnyOutline } from "react-icons/io5";
import { useI18n } from "@/components/Context/I18nProvider";

export const THEME_COOKIE = "qwlee_theme";

export default function ThemeToggle({ className = "" }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `${THEME_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className={`inline-flex items-center gap-2 rounded-md border border-gray-600 px-2 py-1 text-sm ${className}`}
    >
      {dark ? <IoSunnyOutline className="w-4 h-4" /> : <IoMoonOutline className="w-4 h-4" />}
      <span>{t(dark ? "Light mode" : "Dark mode")}</span>
    </button>
  );
}
