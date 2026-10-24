"use client";
// Fiverr-style horizontal filter bar that sits above the gig grid.
//
// Each pill opens a popover that lets the user pick filter values.
// Apply writes to the URL; Clear strips that filter's params. The URL
// is the single source of truth — both this bar and ActiveFilterChips
// re-read it on every render, so chips and pill labels stay in sync.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IoChevronDownOutline,
  IoCheckmarkOutline,
  IoEllipse,
} from "react-icons/io5";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";

const LEVELS = [
  { value: "new", label: "New seller" },
  { value: "level1", label: "Level 1" },
  { value: "level2", label: "Level 2" },
  { value: "topRated", label: "Top rated" },
];

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Arabic",
  "Hindi",
  "Bengali",
  "Mandarin",
];

const DELIVERY_OPTIONS = [
  { value: "", label: "Anytime" },
  { value: "1", label: "Express 24 hours" },
  { value: "3", label: "Up to 3 days" },
  { value: "7", label: "Up to 7 days" },
  { value: "14", label: "Up to 14 days" },
];

const BUDGETS = [
  { value: "value", label: "Value", min: "", max: "20" },
  { value: "mid", label: "Mid-range", min: "20", max: "60" },
  { value: "premium", label: "Premium", min: "60", max: "" },
];

export default function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: categoryData } = useGetAllCategoryQuery({});
  const allCategories = categoryData?.results || [];

  // Read current state from URL.
  const selectedCategories =
    params.get("categories")?.split(",").filter(Boolean) || [];
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const delivery = params.get("delivery") || "";
  const subCategory = params.get("subCategory") || "";
  // Subcategories are offered once exactly one category is selected.
  const parentCategory =
    selectedCategories.length === 1
      ? allCategories.find((c) => c.name === selectedCategories[0])
      : null;
  const { data: subData } = useGetAllCategoryQuery(
    { parentId: parentCategory?.id || parentCategory?._id, limit: 100 },
    { skip: !parentCategory }
  );
  const subCategories = parentCategory ? subData?.results || [] : [];
  const language = params.get("language") || "";
  const country = params.get("country") || "";
  const onlineOnly = params.get("online") === "true";
  const verifiedOnly = params.get("verifiedOnly") === "true";
  const proOnly = params.get("pro") === "true";
  const minRating = params.get("minRating") || "";
  const level = params.get("level") || "";
  const minGigRating = params.get("minGigRating") || "";
  const minReviews = params.get("minReviews") || "";
  const hasVideo = params.get("hasVideo") === "true";
  const serviceCount = (minGigRating ? 1 : 0) + (minReviews ? 1 : 0) + (hasVideo ? 1 : 0);

  function applyParams(mutate) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.push(`/gig?${next.toString()}`, { scroll: false });
  }

  function setOrDelete(next, key, value) {
    if (value === null || value === undefined || value === "" || value === false) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  const sellerCount =
    (level ? 1 : 0) +
    (language ? 1 : 0) +
    (country ? 1 : 0) +
    (onlineOnly ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (proOnly ? 1 : 0) +
    (minRating ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Categories */}
      <Pill
        label="Category"
        active={selectedCategories.length > 0}
        badge={selectedCategories.length || null}
      >
        {({ close }) => (
          <PopoverShell
            title="Categories"
            onClear={() =>
              applyParams((n) => {
                n.delete("categories");
                n.delete("subCategory");
                close();
              })
            }
            onApply={close}
          >
            <div className="max-h-72 overflow-y-auto -mx-2 px-2">
              {allCategories.length === 0 ? (
                <div className="text-xs text-gray-500 py-3">Loading…</div>
              ) : (
                allCategories.map((c) => {
                  const checked = selectedCategories.includes(c.name);
                  return (
                    <button
                      key={c.id || c._id}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? selectedCategories.filter((x) => x !== c.name)
                          : [...selectedCategories, c.name];
                        applyParams((n) => {
                          setOrDelete(n, "categories", next.join(","));
                          n.delete("subCategory");
                        });
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-50"
                    >
                      <span className="text-gray-800">{c.name}</span>
                      {checked && (
                        <IoCheckmarkOutline className="text-emerald-600 w-4 h-4" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverShell>
        )}
      </Pill>

      {/* Subcategory (only when one category is selected) */}
      {subCategories.length > 0 && (
        <Pill label="Subcategory" active={!!subCategory}>
          {({ close }) => (
            <PopoverShell
              title={`${parentCategory.name} subcategories`}
              onClear={() =>
                applyParams((n) => {
                  n.delete("subCategory");
                  close();
                })
              }
              onApply={close}
            >
              <div className="max-h-72 overflow-y-auto -mx-2 px-2">
                {subCategories.map((c) => {
                  const id = c.id || c._id;
                  const checked = subCategory === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        applyParams((n) => setOrDelete(n, "subCategory", checked ? "" : id))
                      }
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-50"
                    >
                      <span className="text-gray-800">{c.name}</span>
                      {checked && <IoCheckmarkOutline className="text-emerald-600 w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </PopoverShell>
          )}
        </Pill>
      )}

      {/* Seller details */}
      <Pill
        label="Seller details"
        active={sellerCount > 0}
        badge={sellerCount || null}
      >
        {({ close }) => (
          <PopoverShell
            title="Seller details"
            wide
            onClear={() =>
              applyParams((n) => {
                ["level", "language", "country", "online", "verifiedOnly", "pro", "minRating"].forEach(
                  (k) => n.delete(k)
                );
                close();
              })
            }
            onApply={close}
          >
            <SectionLabel>Seller level</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() =>
                    applyParams((n) =>
                      setOrDelete(n, "level", level === l.value ? "" : l.value)
                    )
                  }
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
                    level === l.value
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <SectionLabel>Seller speaks</SectionLabel>
            <select
              value={language}
              onChange={(e) =>
                applyParams((n) => setOrDelete(n, "language", e.target.value))
              }
              className="w-full mb-3 border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-emerald-500"
            >
              <option value="">Any language</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <SectionLabel>Seller lives in</SectionLabel>
            <input
              type="text"
              defaultValue={country}
              placeholder="e.g. Bangladesh, United States"
              onBlur={(e) =>
                applyParams((n) =>
                  setOrDelete(n, "country", e.target.value.trim())
                )
              }
              className="w-full mb-3 border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-emerald-500"
            />

            <SectionLabel>Minimum rating</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["", "4.0", "4.5", "4.8"].map((r) => (
                <button
                  key={r || "any"}
                  type="button"
                  onClick={() =>
                    applyParams((n) => setOrDelete(n, "minRating", r))
                  }
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${
                    minRating === r
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {r ? `${r}+ ★` : "Any rating"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Toggle
                label="Online sellers"
                checked={onlineOnly}
                onChange={(v) =>
                  applyParams((n) => setOrDelete(n, "online", v ? "true" : ""))
                }
              />
              <Toggle
                label="Verified sellers only"
                checked={verifiedOnly}
                onChange={(v) =>
                  applyParams((n) =>
                    setOrDelete(n, "verifiedOnly", v ? "true" : "")
                  )
                }
              />
              <Toggle
                label="Pro sellers only"
                checked={proOnly}
                onChange={(v) => applyParams((n) => setOrDelete(n, "pro", v ? "true" : ""))}
              />
            </div>
          </PopoverShell>
        )}
      </Pill>

      {/* Service quality */}
      <Pill label="Service" active={serviceCount > 0} badge={serviceCount || null}>
        {({ close }) => (
          <PopoverShell
            title="Service"
            onClear={() =>
              applyParams((n) => {
                ["minGigRating", "minReviews", "hasVideo"].forEach((k) => n.delete(k));
                close();
              })
            }
            onApply={close}
          >
            <SectionLabel>Service rating</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["", "4", "4.5", "4.8"].map((r) => (
                <button
                  key={r || "any"}
                  type="button"
                  aria-pressed={minGigRating === r}
                  onClick={() => applyParams((n) => setOrDelete(n, "minGigRating", r))}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${
                    minGigRating === r
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {r ? `${r}+ ★` : "Any rating"}
                </button>
              ))}
            </div>
            <SectionLabel>Number of reviews</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["", "1", "10", "50"].map((r) => (
                <button
                  key={r || "any"}
                  type="button"
                  aria-pressed={minReviews === r}
                  onClick={() => applyParams((n) => setOrDelete(n, "minReviews", r))}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${
                    minReviews === r
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {r ? `${r}+ reviews` : "Any"}
                </button>
              ))}
            </div>
            <Toggle
              label="Has a video"
              checked={hasVideo}
              onChange={(v) => applyParams((n) => setOrDelete(n, "hasVideo", v ? "true" : ""))}
            />
          </PopoverShell>
        )}
      </Pill>

      {/* Budget */}
      <Pill
        label="Budget"
        active={!!(minPrice || maxPrice)}
      >
        {({ close }) => (
          <PopoverShell
            title="Budget"
            onClear={() =>
              applyParams((n) => {
                n.delete("minPrice");
                n.delete("maxPrice");
                close();
              })
            }
            onApply={close}
          >
            <div className="flex flex-wrap gap-1.5 mb-3">
              {BUDGETS.map((b) => {
                const sel = minPrice === b.min && maxPrice === b.max;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() =>
                      applyParams((n) => {
                        setOrDelete(n, "minPrice", b.min);
                        setOrDelete(n, "maxPrice", b.max);
                      })
                    }
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${
                      sel
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
            <SectionLabel>Custom price range</SectionLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={minPrice}
                placeholder="Min"
                onBlur={(e) =>
                  applyParams((n) => setOrDelete(n, "minPrice", e.target.value))
                }
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-emerald-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="number"
                defaultValue={maxPrice}
                placeholder="Max"
                onBlur={(e) =>
                  applyParams((n) => setOrDelete(n, "maxPrice", e.target.value))
                }
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none focus:border-emerald-500"
              />
            </div>
          </PopoverShell>
        )}
      </Pill>

      {/* Delivery time */}
      <Pill label="Delivery time" active={!!delivery}>
        {({ close }) => (
          <PopoverShell
            title="Delivery time"
            onClear={() =>
              applyParams((n) => {
                n.delete("delivery");
                close();
              })
            }
            onApply={close}
          >
            <div className="space-y-1">
              {DELIVERY_OPTIONS.map((d) => {
                const sel = delivery === d.value;
                return (
                  <button
                    key={d.value || "any"}
                    type="button"
                    onClick={() =>
                      applyParams((n) => setOrDelete(n, "delivery", d.value))
                    }
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded ${
                      sel ? "bg-emerald-50 text-emerald-800" : "hover:bg-gray-50 text-gray-800"
                    }`}
                  >
                    <span>{d.label}</span>
                    {sel && <IoCheckmarkOutline className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </PopoverShell>
        )}
      </Pill>

      {/* Quick toggle for Online sellers — pinned outside the dropdown
          like Fiverr's "Online sellers" pill. */}
      <button
        type="button"
        onClick={() =>
          applyParams((n) =>
            setOrDelete(n, "online", onlineOnly ? "" : "true")
          )
        }
        className={`text-sm font-medium px-3.5 py-2 rounded-full border transition inline-flex items-center gap-1.5 ${
          onlineOnly
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
        }`}
      >
        <IoEllipse
          className={`w-2 h-2 ${onlineOnly ? "text-emerald-500" : "text-gray-400"}`}
        />
        Online sellers
      </button>
    </div>
  );
}

function Pill({ label, active, badge, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-sm font-medium px-3.5 py-2 rounded-full border transition inline-flex items-center gap-1.5 ${
          active
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
        }`}
      >
        {label}
        {badge != null && (
          <span className="text-xs font-semibold bg-emerald-600 text-white rounded-full px-1.5 py-0.5">
            {badge}
          </span>
        )}
        <IoChevronDownOutline
          className={`w-3.5 h-3.5 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          {/* Phones: bottom sheet with a backdrop. sm and up: popover. */}
          <div className="sm:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={label}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:z-30 sm:max-h-none sm:overflow-visible"
          >
            {children({ close: () => setOpen(false) })}
          </div>
        </>
      )}
    </div>
  );
}

function PopoverShell({ title, wide, children, onApply, onClear }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-t-2xl sm:rounded-xl shadow-xl p-4 w-full ${
        wide ? "sm:w-[340px]" : "sm:w-[280px]"
      }`}
      style={{ boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Clear
        </button>
      </div>
      {children}
      <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onApply}
          className="text-sm font-semibold bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-gray-800 cursor-pointer py-1">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition ${
          checked ? "bg-emerald-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}
