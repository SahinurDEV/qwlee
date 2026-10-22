"use client";
// Navbar "Categories" dropdown. Renders all real categories from
// /v1/categories with their icons. Click-outside closes; clicking a
// category routes to /gig?categories=NAME so the gig list filters.

import { useI18n } from "@/components/Context/I18nProvider";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoChevronDown, IoChevronUp, IoAppsOutline } from "react-icons/io5";
import { base } from "@/lib/constant";
import CategoryIcon from "@/components/common/CategoryIcon";

export default function CategoriesMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const rootRef = useRef(null);

  // Fetch once on mount.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${base}/v1/categories?limit=24`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        setCategories(json?.data?.attributes?.results || []);
      } catch (_) {
        /* network blip — render an empty dropdown rather than an error */
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Close when clicking outside.
  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Close on Escape — keeps keyboard users happy.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 px-3 py-2 rounded text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition text-sm"
      >
        <IoAppsOutline className="w-4 h-4" />
        {t("categories")}
        {open ? (
          <IoChevronUp className="w-4 h-4" />
        ) : (
          <IoChevronDown className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-[640px] max-w-[92vw] bg-white border border-gray-100 rounded-2xl overflow-hidden z-50"
          style={{ boxShadow: "0 12px 36px rgba(15,23,42,0.12)" }}
        >
          <div className="p-2">
            {categories.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500">
                Loading categories…
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {categories.map((c) => (
                  <li key={c._id || c.id}>
                    <Link
                      href={`/gig?categories=${encodeURIComponent(c.name)}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition group"
                    >
                      <span className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-gray-50 text-gray-700 group-hover:bg-white group-hover:text-emerald-700 transition">
                        <CategoryIcon category={c} size={20} />
                      </span>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-emerald-700">
                        {c.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between text-xs text-gray-500">
            <span>{categories.length} categories</span>
            <Link
              href="/services"
              onClick={() => setOpen(false)}
              className="text-emerald-700 hover:underline font-medium"
            >
              Browse all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
