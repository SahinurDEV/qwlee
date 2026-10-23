"use client";
// /gig — marketplace search results page.
//
// Single-column layout: emerald hero with in-page search (debounced,
// URL-bound) → sort + count strip → 4-up gig grid → pagination.
// No filter sidebar — keep the search results clean and let users
// re-filter via the navbar Categories dropdown or by editing the URL.
//
// All filter state is still reflected in the URL so /gig?title=…&sortBy=…
// remains shareable; ActiveFilterChips still shows what's narrowing the
// results so users can clear an applied category in one click.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "antd";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { IoSearch, IoClose } from "react-icons/io5";

import { useGetAllGigQuery } from "@/app/redux/features/getAllGigApi";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import AllCard from "./AllCard";
import AllCardTopFilters from "./AllCardTopFilters";
import GigCardSkeleton from "./GigCardSkeleton";
import FilterBar from "./FilterBar";
import ActiveFilterChips from "./ActiveFilterChips";
import trackSearch from "@/utils/trackSearch";

const LIMIT = 12;

function GigContent() {
  const router = useRouter();
  const params = useSearchParams();

  const categories = params.get("categories")?.split(",").filter(Boolean) || [];
  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");
  const title = params.get("title") || "";
  const sortBy = params.get("sortBy") || undefined;
  const delivery = params.get("delivery") || undefined;
  const subCategory = params.get("subCategory") || undefined;
  const language = params.get("language") || undefined;
  const country = params.get("country") || undefined;
  const onlineOnly = params.get("online") === "true";
  const verifiedOnly = params.get("verifiedOnly") === "true";
  const pro = params.get("pro") === "true";
  const minRating = params.get("minRating") || undefined;
  const level = params.get("level") || undefined;
  const minGigRating = params.get("minGigRating") || undefined;
  const minReviews = params.get("minReviews") || undefined;
  const hasVideo = params.get("hasVideo") === "true";

  const [searchInput, setSearchInput] = useState(title);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearchInput(title);
    setCurrentPage(1);
    if (title) trackSearch(title, { route: "/gig" });
  }, [title]);

  // Debounce the input → URL update. The URL is the source of truth.
  // IMPORTANT: depend on PRIMITIVE values (string), not the `params` or
  // `router` objects — those get fresh references on every render, which
  // would re-fire this effect → push URL → re-render → loop forever.
  const paramsString = params.toString();
  useEffect(() => {
    if (searchInput === title) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(paramsString);
      const v = searchInput.trim();
      if (v) next.set("title", v);
      else next.delete("title");
      router.push(`/gig?${next.toString()}`, { scroll: false });
    }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, title, paramsString]);

  const { data: categoryData } = useGetAllCategoryQuery({});
  const allCategories = categoryData?.results || [];

  // Translate the human-readable category names from the URL into the
  // ObjectIds the backend filter expects.
  const categoryIds = useMemo(() => {
    if (!categories.length || !allCategories.length) return undefined;
    return allCategories
      .filter((c) => categories.includes(c.name))
      .map((c) => c.id);
  }, [categories, allCategories]);

  const { data, isFetching, isError, error } = useGetAllGigQuery({
    categories: categoryIds,
    subCategory,
    minPrice,
    maxPrice,
    search: title || undefined,
    sortBy,
    delivery,
    language,
    country,
    online: onlineOnly,
    verifiedOnly,
    pro,
    minRating,
    level,
    minGigRating,
    minReviews,
    hasVideo,
    limit: LIMIT,
    page: currentPage,
  });

  const gigs = data?.data?.attributes?.results || [];
  const total = data?.data?.attributes?.totalResults || 0;
  const promoted = data?.data?.attributes?.promoted || [];

  useEffect(() => {
    if (isError && error?.message) toast.error(error.message);
  }, [isError, error]);

  function clearSearch() {
    setSearchInput("");
  }

  return (
    <main>
      {/* Hero with in-page search */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-200/40 blur-3xl"
        />
        <div className="relative container mx-auto px-4 py-10 md:py-16 max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-emerald-100 text-emerald-700 text-xs font-medium">
            Marketplace
          </span>
          <h1 className="mt-4 text-2xl md:text-4xl font-bold tracking-tight text-gray-900">
            {title ? `Results for “${title}”` : "Find a freelance service"}
          </h1>
          <p className="mt-2 md:mt-3 text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
            Search across {total ? `${total.toLocaleString()} gigs` : "the Qwlee marketplace"}.
          </p>

          <div className="mt-6 mx-auto max-w-xl">
            <div className="flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-emerald-500 transition">
              <div className="pl-4 text-gray-400">
                <IoSearch className="w-5 h-5" />
              </div>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="What service are you looking for?"
                aria-label="Search gigs"
                className="flex-1 px-3 py-3.5 bg-transparent outline-none text-base"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-3 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <IoClose className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results — full width, no sidebar */}
      <section className="container mx-auto px-4 py-8 md:py-10">
        <FilterBar />
        <ActiveFilterChips />
        <AllCardTopFilters totalResults={total} />

        {isFetching && gigs.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <GigCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState />
        ) : gigs.length === 0 ? (
          <EmptyState
            title={title}
            categories={categories}
            onClearSearch={clearSearch}
          />
        ) : (
          <>
            {promoted.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Sponsored</div>
                <AllCard data={promoted} sponsored />
              </div>
            )}
            <AllCard data={gigs} />
            {total > LIMIT && (
              <Pagination
                current={currentPage}
                pageSize={LIMIT}
                total={total}
                onChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 200, behavior: "smooth" });
                }}
                showSizeChanger={false}
                className="flex justify-center mt-8"
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-8 text-center">
      <h3 className="text-base font-semibold text-rose-700">
        Couldn&rsquo;t load results
      </h3>
      <p className="text-sm text-rose-600 mt-1">
        Please refresh, or try a different search.
      </p>
    </div>
  );
}

function EmptyState({ title, categories, onClearSearch }) {
  return (
    <div className="flex flex-col items-center text-center py-14">
      <Image
        width={200}
        height={200}
        src="/not-data.svg"
        alt=""
        className="opacity-80"
      />
      <p className="mt-3 text-lg font-medium text-gray-900">No gigs match</p>
      <p className="text-sm text-gray-500 mt-1 max-w-md">
        {title && `No results for “${title}”`}
        {title && categories.length > 0 && " in "}
        {categories.length > 0 && categories.join(", ")}
        {!title && categories.length === 0 && "Try adjusting your filters."}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {title && (
          <button
            type="button"
            onClick={onClearSearch}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
          >
            Clear search
          </button>
        )}
        <Link
          href="/gig"
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Browse all gigs
        </Link>
      </div>
    </div>
  );
}

export default function Gig() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <GigCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <GigContent />
    </Suspense>
  );
}
