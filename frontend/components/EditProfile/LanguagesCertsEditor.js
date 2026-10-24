"use client";
// Editors for languages (with level) and certifications on the seller
// profile form. Controlled: parent keeps the arrays and sends them.
import { IoAddOutline, IoTrashOutline } from "react-icons/io5";

export const LANG_LEVELS = [
  ["basic", "Basic"],
  ["conversational", "Conversational"],
  ["fluent", "Fluent"],
  ["native", "Native / bilingual"],
];

export const initialLanguages = (user) =>
  Array.isArray(user?.languages) && user.languages.length
    ? user.languages
    : String(user?.language || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((name) => ({ name, level: "fluent" }));

const input = "w-full min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-500";

export function LanguagesEditor({ value, onChange }) {
  const set = (i, patch) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label={`Language ${i + 1}`} value={l.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value.replace(/,/g, "") })} placeholder="e.g. Spanish" className={input} />
          <select aria-label={`Level for language ${i + 1}`} value={l.level} onChange={(e) => set(i, { level: e.target.value })} className={`${input} max-w-[45%]`}>
            {LANG_LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${l.name || "language"}`} className="p-2 text-gray-500 hover:text-rose-600">
            <IoTrashOutline />
          </button>
        </div>
      ))}
      {value.length < 10 && (
        <button type="button" onClick={() => onChange([...value, { name: "", level: "conversational" }])} className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium">
          <IoAddOutline /> Add language
        </button>
      )}
    </div>
  );
}

export function CertificationsEditor({ value, onChange }) {
  const set = (i, patch) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-3">
      {value.map((c, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-lg border border-gray-100 p-3">
          <input aria-label="Certification title" value={c.title || ""} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} placeholder="Title, e.g. AWS Certified Developer" className={`${input} sm:col-span-5`} />
          <input aria-label="Issuer" value={c.issuer || ""} maxLength={80} onChange={(e) => set(i, { issuer: e.target.value })} placeholder="Issuer" className={`${input} sm:col-span-3`} />
          <input aria-label="Year" value={c.year || ""} inputMode="numeric" maxLength={4} onChange={(e) => set(i, { year: e.target.value.replace(/\D/g, "") })} placeholder="Year" className={`${input} sm:col-span-2`} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="sm:col-span-2 inline-flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-rose-600">
            <IoTrashOutline /> Remove
          </button>
          <input aria-label="Credential link" value={c.url || ""} maxLength={300} onChange={(e) => set(i, { url: e.target.value })} placeholder="https:// link to verify (optional)" className={`${input} sm:col-span-12`} />
        </div>
      ))}
      {value.length < 10 && (
        <button type="button" onClick={() => onChange([...value, { title: "", issuer: "", year: "", url: "" }])} className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium">
          <IoAddOutline /> Add certification
        </button>
      )}
    </div>
  );
}

export const cleanLanguages = (list) => list.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), level: l.level }));
export const cleanCertifications = (list) =>
  list
    .filter((c) => (c.title || "").trim())
    .map((c) => ({ title: c.title.trim(), issuer: (c.issuer || "").trim(), ...(c.year ? { year: Number(c.year) } : {}), ...((c.url || "").trim() ? { url: c.url.trim() } : {}) }));
