"use client";
// Fiverr-style leave-a-review modal. Five stars (hover preview),
// 10–1000 char text body, gig title context strip so the buyer
// remembers what they're rating. Calls POST /reviews with the
// orderId — the backend derives gigId/freelancerId from the order so
// the buyer can't misattribute.

import { useEffect, useState } from "react";
import { IoClose, IoStar, IoCheckmarkCircle } from "react-icons/io5";
import { toast } from "sonner";

import { useCreateReviewMutation } from "@/app/redux/features/reviewsApi";
import Avatar from "@/components/common/Avatar";

const MIN_LEN = 10;
const MAX_LEN = 1000;

export default function LeaveReviewModal({ open, onClose, order, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [subs, setSubs] = useState({ communication: 0, service: 0, recommend: 0 });
  const [privateRating, setPrivateRating] = useState(0);
  const [privateNote, setPrivateNote] = useState("");
  const [createReview, { isLoading }] = useCreateReviewMutation();

  // Reset when the modal opens for a fresh review.
  useEffect(() => {
    if (open) {
      setRating(0);
      setHover(0);
      setText("");
    }
  }, [open]);

  if (!open) return null;

  const gig = order?.gigId || {};
  const seller = order?.freelancerId || {};
  const len = text.trim().length;
  const canSubmit = rating >= 1 && len >= MIN_LEN && len <= MAX_LEN && !isLoading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const res = await createReview({
      orderId: order?.id || order?._id,
      rating,
      review: text.trim(),
      subRatings: Object.fromEntries(Object.entries(subs).filter(([, v]) => v > 0)),
      ...(privateRating ? { privateRating } : {}),
      ...(privateNote.trim() ? { privateNote: privateNote.trim() } : {}),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't submit your review");
      return;
    }
    toast.success("Thanks for your review!");
    onSuccess?.(res?.data?.data?.attributes);
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Leave a review</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your honest feedback helps the community.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <IoClose className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Gig + seller context */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
            {gig.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gig.images[0]}
                alt=""
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-200 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 line-clamp-1">
                {gig.title || "Gig"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                <Avatar
                  src={seller.image}
                  name={seller.fullName}
                  size={16}
                  rounded
                />
                <span className="truncate">
                  {seller.fullName || seller.username || "Seller"}
                </span>
              </div>
            </div>
          </div>

          {/* Star picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How was your experience?
            </label>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHover(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="p-1"
                  >
                    <IoStar
                      className={`w-8 h-8 transition ${
                        active ? "text-amber-500" : "text-gray-200"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-3 text-sm text-gray-500">
                {rating > 0
                  ? ["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]
                  : "Tap a star"}
              </span>
            </div>
          </div>

          {/* Optional breakdown */}
          <div className="space-y-2">
            {[["communication", "Seller communication"], ["service", "Service as described"], ["recommend", "Would recommend"]].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">{label}</span>
                <div className="flex" role="radiogroup" aria-label={label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={subs[k] === n} aria-label={`${label}: ${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setSubs((x) => ({ ...x, [k]: n }))} className="p-0.5">
                      <IoStar className={`w-5 h-5 ${subs[k] >= n ? "text-amber-500" : "text-gray-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Private feedback: only the qwlee team sees it */}
          <fieldset className="rounded-xl border border-gray-200 p-3 space-y-2">
            <legend className="px-1 text-sm font-medium text-gray-800">Private feedback (optional)</legend>
            <p className="text-xs text-gray-500">Only the qwlee team sees this. It is not shown to the seller or on the gig.</p>
            <div className="flex" role="radiogroup" aria-label="Private rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={privateRating === n} aria-label={`Private rating: ${n} star${n > 1 ? "s" : ""}`} onClick={() => setPrivateRating(privateRating === n ? 0 : n)} className="p-0.5">
                  <IoStar className={`w-5 h-5 ${privateRating >= n ? "text-sky-500" : "text-gray-200"}`} />
                </button>
              ))}
            </div>
            <label htmlFor="private-note" className="sr-only">Private note</label>
            <textarea id="private-note" rows={2} maxLength={1000} value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Anything we should know?" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          </fieldset>

          {/* Review text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Share details of your experience
            </label>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="What did you like? Was the delivery on time? Would you recommend this seller?"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none"
            />
            <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
              <span>
                {len < MIN_LEN
                  ? `At least ${MIN_LEN - len} more character${
                      MIN_LEN - len === 1 ? "" : "s"
                    }`
                  : "Looks good"}
              </span>
              <span>
                {len}/{MAX_LEN}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                "Submitting…"
              ) : (
                <>
                  <IoCheckmarkCircle className="w-4 h-4" />
                  Submit review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
