"use client";
import { LANGS } from "@/lib/i18n";
import { setLanguage, useI18n } from "@/components/Context/I18nProvider";

export default function LanguageSelect({ className = "" }) {
  const { lang, t } = useI18n();
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span>{t("language")}</span>
      <select
        value={lang}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Language"
        className="rounded-md border border-gray-600 bg-transparent px-2 py-1 text-sm"
      >
        {Object.entries(LANGS).map(([k, name]) => (
          <option key={k} value={k} className="text-gray-900">{name}</option>
        ))}
      </select>
    </label>
  );
}
