"use client";
// Self-contained search input + suggestions panel.
//
// Empty state → shows recent searches (localStorage) and trending tags.
// Typed state → debounced fetch of /v1/gig?title=… and
//   /v1/users?role=freelancer&fullName=… in parallel; renders both groups.
// Submit / suggestion click → /gig?title=<term> (or the user profile for
//   freelancer rows), and saves the term to recents.
//
// One implementation, two surfaces: navbar TopNav uses size="sm",
// HeroQwlee uses size="lg".

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IoSearch, IoTimeOutline, IoClose, IoTrendingUp } from "react-icons/io5";
import { base } from "@/lib/constant";
import Avatar from "@/components/common/Avatar";
import trackSearch from "@/utils/trackSearch";

const RECENTS_KEY = "qwlee:search:recents";
const RECENT_LIMIT = 6;
const TRENDING = [
  "Next.js",
  "UI/UX",
  "React Native",
  "SEO",
  "Video editing",
  "AI",
  "Copywriting",
];

function readRecents() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecents(list) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)));
  } catch {
    /* quota / disabled storage — silent ok */
  }
}

function pushRecent(term) {
  if (!term) return;
  const t = term.trim();
  if (!t) return;
  const cur = readRecents().filter((x) => x.toLowerCase() !== t.toLowerCase());
  writeRecents([t, ...cur]);
}

function clearRecents() {
  writeRecents([]);
}

export default function SearchSuggestions({
  size = "sm",
  placeholder = "Find a service…",
  rotatingPlaceholders = null,
  autoFocus = false,
  className = "",
}) {
  const router = useRouter();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState([]);
  const [results, setResults] = useState({ gigs: [], freelancers: [] });
  const [loading, setLoading] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

  // Hydrate recents only on the client to avoid SSR mismatch.
  useEffect(() => {
    setRecents(readRecents());
  }, []);

  // Rotating placeholder when caller provides candidates.
  useEffect(() => {
    if (!rotatingPlaceholders || rotatingPlaceholders.length < 2) return;
    const t = setInterval(
      () => setPhIdx((i) => (i + 1) % rotatingPlaceholders.length),
      2400
    );
    return () => clearInterval(t);
  }, [rotatingPlaceholders]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounced fetch when query has content.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ gigs: [], freelancers: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const [gigsRes, peopleRes] = await Promise.all([
          fetch(
            `${base}/v1/gig?title=${encodeURIComponent(q)}&limit=5`,
            { signal: ctrl.signal }
          ).then((r) => r.json()),
          fetch(
            `${base}/v1/users?role=freelancer&fullName=${encodeURIComponent(
              q
            )}&limit=4`,
            { signal: ctrl.signal }
          ).then((r) => r.json()),
        ]);
        setResults({
          gigs: gigsRes?.data?.attributes?.results || [],
          freelancers: peopleRes?.data?.attributes?.results || [],
        });
      } catch (err) {
        if (err?.name !== "AbortError") {
          setResults({ gigs: [], freelancers: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  function commitSearch(term) {
    const t = (term ?? query).trim();
    if (!t) return;
    pushRecent(t);
    setRecents(readRecents());
    setOpen(false);
    trackSearch(t, { route: "/gig" });
    router.push(`/gig?title=${encodeURIComponent(t)}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    commitSearch();
  }

  // The bar uses an "input + inline pill button" layout — same approach
  // Fiverr uses. The wrap has a subtle border that brightens on focus,
  // and the submit pill is inset by 4px so it floats inside the bar
  // rather than butting against the edges.
  const sizeClasses =
    size === "lg"
      ? {
          wrap: "rounded-2xl shadow-sm h-14",
          input: "px-4 text-base",
          btn: "m-1.5 px-5 py-2.5 rounded-xl text-base gap-2",
          icon: "w-5 h-5",
        }
      : {
          wrap: "rounded-full h-11 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          input: "px-3 text-sm",
          btn: "m-1 px-4 py-1.5 rounded-full text-sm gap-1.5",
          icon: "w-4 h-4",
        };

  // Keep placeholders short so mobile inputs do not clip mid-word
  // (e.g. "Logo designe…"). Ellipsis via placeholder:truncate below.
  const dynPlaceholder =
    rotatingPlaceholders?.[phIdx]
      ? `Try ${rotatingPlaceholders[phIdx]}`
      : placeholder;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <form
        onSubmit={handleSubmit}
        className={`flex items-center min-w-0 bg-white border border-gray-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition ${sizeClasses.wrap}`}
      >
        <div className={`${size === "lg" ? "pl-4" : "pl-3.5"} text-gray-400 shrink-0`}>
          <IoSearch className={sizeClasses.icon} />
        </div>
        {/* min-w-0 lets the input shrink below its intrinsic size (the
            long rotating placeholder would otherwise force horizontal
            overflow on narrow viewports). w-full + flex-1 keeps it
            filling all available space. */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={dynPlaceholder}
          aria-label="Search Qwlee"
          className={`flex-1 w-full min-w-0 bg-transparent outline-none placeholder:text-gray-400 placeholder:truncate ${sizeClasses.input}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className={`${size === "lg" ? "px-2.5" : "px-2"} text-gray-400 hover:text-gray-700 shrink-0`}
            aria-label="Clear"
          >
            <IoClose className={sizeClasses.icon} />
          </button>
        )}
        <button
          type="submit"
          aria-label="Search"
          className={`inline-flex items-center justify-center bg-gray-900 hover:bg-emerald-600 text-white font-semibold transition shrink-0 ${sizeClasses.btn}`}
        >
          <IoSearch className={sizeClasses.icon} />
          {size === "lg" ? <span>Search</span> : <span className="hidden sm:inline">Search</span>}
        </button>
      </form>

      {open && (
        // Solid-white panel — back to the original clean look. z-index
        // stays at 60 so it sits above any decorative animated blob /
        // hover layers behind it.
        <div
          className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-[60] max-w-full"
          style={{ boxShadow: "0 12px 36px rgba(15,23,42,0.12)" }}
        >
          {query.trim() === "" ? (
            // Empty-state panel — same scroll bounds as the typed-state
            // branch below so the dropdown can't grow unbounded when the
            // user has many recent searches.
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {recents.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between px-2 py-1.5 gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 min-w-0">
                      <IoTimeOutline className="shrink-0" />
                      <span className="truncate">Recent searches</span>
                    </span>
                    <button
                      onClick={() => {
                        clearRecents();
                        setRecents([]);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                  <ul>
                    {recents.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => commitSearch(r)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 text-sm flex items-center gap-2 min-w-0"
                        >
                          <IoTimeOutline className="text-gray-400 shrink-0" />
                          <span className="truncate flex-1 min-w-0">{r}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <IoTrendingUp /> Trending
                </div>
                <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                  {TRENDING.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => commitSearch(t)}
                      className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 max-w-full truncate"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="px-3 py-3 text-sm text-gray-500">Searching…</div>
              )}
              {!loading && results.gigs.length === 0 && results.freelancers.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500">
                  No matches. Press Enter to search the marketplace.
                </div>
              )}
              {results.gigs.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Services
                  </div>
                  <ul>
                    {results.gigs.map((g) => (
                      <li key={g._id || g.id}>
                        <Link
                          href={`/gig?id=${g._id || g.id}`}
                          onClick={() => {
                            pushRecent(query);
                            trackSearch(query, { route: "/gig" });
                            setOpen(false);
                          }}
                          className="flex items-start gap-3 px-2 py-2 rounded hover:bg-gray-50"
                        >
                          <div className="shrink-0 w-10 h-10 rounded-md bg-gray-100 overflow-hidden">
                            {g.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={g.images[0]}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 line-clamp-1">
                              {g.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              From ${g.price}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {results.freelancers.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Freelancers
                  </div>
                  <ul>
                    {results.freelancers.map((u) => (
                      <li key={u._id || u.id}>
                        <Link
                          href={u.username ? `/${u.username}` : `/freelancer-details?id=${u._id || u.id}`}
                          onClick={() => {
                            pushRecent(query);
                            trackSearch(query, { route: "/gig" });
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50"
                        >
                          <Avatar src={u.image} name={u.fullName} size={36} rounded />
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 line-clamp-1">
                              {u.fullName}
                            </div>
                            {u.username && (
                              <div className="text-xs text-gray-500">@{u.username}</div>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-gray-100 p-2">
                <button
                  type="button"
                  onClick={() => commitSearch()}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-50 text-emerald-700"
                >
                  See all results for &ldquo;{query}&rdquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
