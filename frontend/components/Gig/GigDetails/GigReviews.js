"use client";
// Reviews section. Header shows a rating summary (big number + star +
// total count + 5-bar histogram if data is available). Body is a list of
// review cards; empty state renders a tidy placeholder instead of red
// text.

import { useState } from "react";
import { IoStar } from "react-icons/io5";
import { useGetAllReviewApiQuery } from "@/app/redux/features/getAllReviewApi";
import GigReviewCard from "./GigReviewCard";
import { baseApi } from "@/app/redux/api/baseApi";

const summaryApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getReviewSummary: b.query({ query: (gigId) => `/reviews/summary?gigId=${gigId}`, transformResponse: (r) => r?.data?.attributes, providesTags: ["GigReviews"] }),
  }),
});

export default function GigReviews({ id, sellerRating = 0, sellerReviewTotal = 0 }) {
  const [star, setStar] = useState(0);
  const [sort, setSort] = useState("newest");
  const [withReply, setWithReply] = useState(false);
  const [limit, setLimit] = useState(10);
  const { data, isFetching } = useGetAllReviewApiQuery(
    { userId: null, gigId: id, rating: star || undefined, sort, withReply, limit },
    { skip: !id }
  );
  const reviews = data?.data?.attributes?.results || [];
  const totalMatching = data?.data?.attributes?.totalResults ?? reviews.length;
  const filtered = !!star || withReply;
  const { data: summary } = summaryApi.useGetReviewSummaryQuery(id, { skip: !id });
  const breakdown = [["communication", "Seller communication"], ["service", "Service as described"], ["recommend", "Would recommend"]]
    .filter(([k]) => summary?.breakdown?.[k] != null);
  // Totals come from the server-side summary so they don't change with
  // the filters below.
  const total = summary?.count ?? sellerReviewTotal ?? 0;
  const buckets = [5, 4, 3, 2, 1].map((n) => {
    const count = summary?.histogram?.[n] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { n, count, pct };
  });
  const avg = summary?.average ?? sellerRating;

  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold text-gray-900">Reviews</h2>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-bold text-gray-900">
              {Number(avg || 0).toFixed(1)}
            </span>
            <IoStar className="text-amber-500" />
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} review${total === 1 ? "" : "s"}` : "No reviews yet"}
          </div>
        </div>
        <div className="md:col-span-8 space-y-1.5">
          {buckets.map((b) => (
            <button
              type="button"
              key={b.n}
              onClick={() => { setStar(star === b.n ? 0 : b.n); setLimit(10); }}
              disabled={!b.count}
              aria-pressed={star === b.n}
              aria-label={`${b.n} star reviews: ${b.count}`}
              className={`w-full flex items-center gap-2 text-xs rounded px-1 py-0.5 disabled:cursor-default ${star === b.n ? "bg-amber-50 ring-1 ring-amber-300" : "hover:bg-gray-50"}`}
            >
              <span className="w-3 text-gray-500">{b.n}</span>
              <IoStar className="text-amber-500" />
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-500 tabular-nums">
                {b.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {breakdown.length ? (
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {breakdown.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <dt className="text-gray-600">{label}</dt>
              <dd className="flex items-center gap-1 font-semibold text-gray-900">{summary.breakdown[k].toFixed(1)}<IoStar className="text-amber-500" aria-hidden /></dd>
            </div>
          ))}
        </dl>
      ) : null}

      {total > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <span className="text-gray-500">Sort</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setLimit(10); }} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white">
              <option value="newest">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          <select
            value={star}
            onChange={(e) => { setStar(Number(e.target.value)); setLimit(10); }}
            aria-label="Filter by rating"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          >
            <option value={0}>All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-gray-700">
            <input type="checkbox" checked={withReply} onChange={(e) => { setWithReply(e.target.checked); setLimit(10); }} />
            With seller reply
          </label>
          {filtered && (
            <button type="button" onClick={() => { setStar(0); setWithReply(false); setLimit(10); }} className="text-emerald-700 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-5 space-y-4">
        {isFetching && reviews.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            Loading reviews…
          </div>
        )}
        {!isFetching && reviews.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            {filtered ? "No reviews match these filters." : "No reviews yet — be the first to leave one after your order."}
          </div>
        )}
        {reviews.map((item) => (
          <GigReviewCard key={item.id || item._id} item={item} />
        ))}
        {reviews.length < totalMatching && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setLimit((l) => Math.min(l + 10, 50))}
              disabled={isFetching || limit >= 50}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {isFetching ? "Loading…" : `Show more reviews (${totalMatching - reviews.length} more)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
