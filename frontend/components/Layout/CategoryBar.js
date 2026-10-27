"use client";
// Sticky horizontal category strip. Pulls real categories from the
// backend on mount; clicking a category routes to /gig?categories=NAME
// which the existing gig list page already filters on.
//
// Hidden on the auth pages and inside the dashboard — keeps those views
// focused.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { base } from "@/lib/constant";
import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import CategoryIcon from "@/components/common/CategoryIcon";

const HIDE_ON = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/change-password",
  "/verify-email",
]);

export default function CategoryBar() {
  const pathname = usePathname();
  const user = useUser();
  const { isSelling } = useViewMode(user);
  const [categories, setCategories] = useState([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const stripRef = useRef(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${base}/v1/categories?limit=20`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        setCategories(json?.data?.attributes?.results || []);
      } catch (_) {
        /* network blip — render empty strip rather than error UI */
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Recalculate scroll affordances whenever the strip resizes or scrolls.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [categories.length]);

  if (HIDE_ON.has(pathname) || pathname?.startsWith("/dashboard")) return null;
  // In Selling mode the category strip is noise — sellers manage their
  // own gigs from the dashboard, not by drilling into the buyer
  // taxonomy. Hide it until they switch back to Buying.
  if (isSelling && !!user) return null;
  if (!categories.length) return null;

  function nudge(dir) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  return (
    <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
      <div className="container mx-auto px-3 md:px-6 relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            className="hidden md:flex z-10 absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            aria-label="Scroll categories left"
          >
            <IoChevronBack className="w-4 h-4 text-gray-700" />
          </button>
        )}
        <ul
          ref={stripRef}
          className="flex gap-1 md:gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {categories.map((c) => (
            <li key={c._id || c.id} className="shrink-0">
              <Link
                href={`/gig?categories=${encodeURIComponent(c.name)}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-700 hover:text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-50 transition"
              >
                <CategoryIcon category={c} size={16} className="opacity-70" />
                <span>{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {canScrollRight && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-white via-white/90 to-transparent" />
        )}
        {canScrollLeft && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-white via-white/90 to-transparent" />
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => nudge(1)}
            className="hidden md:flex z-10 absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            aria-label="Scroll categories right"
          >
            <IoChevronForward className="w-4 h-4 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
}
