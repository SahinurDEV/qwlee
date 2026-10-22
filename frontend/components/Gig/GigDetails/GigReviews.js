"use client";
// Reviews section. Header shows a rating summary (big number + star +
// total count + 5-bar histogram if data is available). Body is a list of
// review cards; empty state renders a tidy placeholder instead of red
// text.

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
  const { data, isFetching } = useGetAllReviewApiQuery({
    userId: null,
    gigId: id,
  });
  const reviews = data?.data?.attributes?.results || [];
  const { data: summary } = summaryApi.useGetReviewSummaryQuery(id, { skip: !id });
  const breakdown = [["communication", "Seller communication"], ["service", "Service as described"], ["recommend", "Would recommend"]]
    .filter(([k]) => summary?.breakdown?.[k] != null);
  const total = reviews.length || sellerReviewTotal || 0;

  // Compute distribution from actual reviews. Falls back to the seller
  // average if there are no items.
  const buckets = [5, 4, 3, 2, 1].map((n) => {
    const count = reviews.filter((r) => Math.round(r.rating) === n).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { n, count, pct };
  });
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length
      : sellerRating;

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
            <div key={b.n} className="flex items-center gap-2 text-xs">
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
            </div>
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

      <div className="mt-6 border-t border-gray-100 pt-5 space-y-4">
        {isFetching && reviews.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            Loading reviews…
          </div>
        )}
        {!isFetching && reviews.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            No reviews yet — be the first to leave one after your order.
          </div>
        )}
        {reviews.map((item) => (
          <GigReviewCard key={item.id || item._id} item={item} />
        ))}
      </div>
    </div>
  );
}
