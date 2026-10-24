"use client";
// Two-way reviews: the seller rates the buyer after completion. The buyer
// sees it once they have reviewed the order too (double-blind).
import { useState } from "react";
import { toast } from "sonner";
import { IoStar } from "react-icons/io5";
import { baseApi } from "@/app/redux/api/baseApi";

const api = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getBuyerReviewForOrder: b.query({ query: (orderId) => `/reviews/buyer/order/${orderId}`, transformResponse: (r) => r?.data?.attributes?.review ?? null, providesTags: ["GigReviews"] }),
    addBuyerReview: b.mutation({ query: (body) => ({ url: "/reviews/buyer", method: "POST", body }), invalidatesTags: ["GigReviews"] }),
  }),
});

const Stars = ({ n }) => (
  <span className="inline-flex text-amber-500" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <IoStar key={i} className={i <= n ? "" : "text-gray-200"} />)}
  </span>
);

export default function BuyerReviewCard({ orderId, isSeller }) {
  const { data: review, isLoading } = api.useGetBuyerReviewForOrderQuery(orderId, { skip: !orderId });
  const [add, { isLoading: saving }] = api.useAddBuyerReviewMutation();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  if (isLoading) return null;

  if (!isSeller) {
    if (!review) return null;
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2" aria-labelledby="br-h">
        <h3 id="br-h" className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Seller&apos;s review of you</h3>
        {review.pending ? (
          <p className="text-sm text-gray-600">The seller left you a review. Leave yours to see it.</p>
        ) : (
          <>
            <Stars n={review.rating} />
            {review.review ? <p className="text-sm text-gray-700 break-words">&ldquo;{review.review}&rdquo;</p> : null}
          </>
        )}
      </section>
    );
  }

  const submit = async () => {
    const r = await add({ orderId, rating, review: text });
    if (r.error) return toast.error(r.error?.data?.message || "Could not save");
    toast.success("Thanks — the buyer sees it after they review you");
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3" aria-labelledby="br-h">
      <h3 id="br-h" className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Rate this buyer</h3>
      {review ? (
        <>
          <Stars n={review.rating} />
          {review.review ? <p className="text-sm text-gray-700 break-words">&ldquo;{review.review}&rdquo;</p> : null}
          <p className="text-xs text-gray-500">{review.publishedAt ? "Visible on the buyer's profile." : "Hidden until the buyer reviews you or the review window ends."}</p>
        </>
      ) : (
        <>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setRating(i)} className={`text-2xl p-1 ${i <= rating ? "text-amber-500" : "text-gray-300"}`}>
                <IoStar />
              </button>
            ))}
          </div>
          <label htmlFor="br-text" className="sr-only">Your review</label>
          <textarea id="br-text" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="How was working with this buyer? (optional)" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          <button type="button" disabled={!rating || saving} onClick={submit} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">Submit review</button>
          <p className="text-xs text-gray-500">The buyer sees your review only after leaving theirs, so neither side is influenced.</p>
        </>
      )}
    </section>
  );
}
