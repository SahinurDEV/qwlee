"use client";
import { useI18n } from "@/components/Context/I18nProvider";
import useCurrency, { setCurrency } from "@/hooks/useCurrency";

const NAMES = { USD: "US dollar", EUR: "Euro", GBP: "British pound", BDT: "Bangladeshi taka", INR: "Indian rupee", AUD: "Australian dollar", CAD: "Canadian dollar", JPY: "Japanese yen" };

export default function CurrencySelect({ className = "" }) {
  const { code, codes } = useCurrency();
  const { t } = useI18n();
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span>{t("currency")}</span>
      <select
        value={code}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Display currency"
        className="rounded-md border border-gray-600 bg-transparent px-2 py-1 text-sm"
      >
        {codes.map((c) => (
          <option key={c} value={c} className="text-gray-900">
            {c} · {NAMES[c] || c}
          </option>
        ))}
      </select>
    </label>
  );
}
