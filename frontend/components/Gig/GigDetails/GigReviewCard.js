// Single review row. Shows the buyer's stars + text, then either the
// existing seller reply (Fiverr-style indented response block) or, if
// the current viewer is the gig's freelancer and hasn't replied yet,
// the inline reply composer.

import { useState } from "react";
import moment from "moment";
import { IoStar, IoChatbubbleEllipsesOutline, IoSend } from "react-icons/io5";
import { toast } from "sonner";

import Avatar from "@/components/common/Avatar";
import useUser from "@/hooks/useUser";
import { useReplyToReviewMutation } from "@/app/redux/features/reviewsApi";

const MAX_REPLY = 1500;

export default function GigReviewCard({ item }) {
  const user = useUser();
  const reviewer = item?.userId || {};
  const seller = item?.freelancerId || {};
  const rating = Number(item?.rating || 0);
  const stars = Math.round(rating);

  const reply = item?.sellerReply;
  const hasReply = !!(reply && reply.message);
  const isSellerViewer =
    !!user &&
    String(seller?.id || seller?._id || item?.freelancerId) ===
      String(user.id || user._id);

  const [composerOpen, setComposerOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyToReview, { isLoading }] = useReplyToReviewMutation();

  async function handleReply(e) {
    e.preventDefault();
    const msg = replyText.trim();
    if (!msg) return;
    const res = await replyToReview({
      reviewId: item.id || item._id,
      message: msg,
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't post reply");
      return;
    }
    toast.success("Reply posted");
    setComposerOpen(false);
    setReplyText("");
  }

  return (
    <div className="flex gap-3">
      <Avatar src={reviewer.image} name={reviewer.fullName} size={40} rounded />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {reviewer.fullName || "Customer"}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {reviewer.location || ""}
            </div>
          </div>
          <div className="text-xs text-gray-500 shrink-0">
            {item?.createdAt ? moment(item.createdAt).format("D MMM YYYY") : ""}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1 text-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <IoStar
              key={i}
              className={i < stars ? "text-amber-500" : "text-gray-200"}
            />
          ))}
          <span className="ml-1 font-medium text-gray-900">
            {rating.toFixed(1)}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          {item?.review}
        </p>

        {/* Seller's response — Fiverr-style indented block */}
        {hasReply && (
          <div className="mt-3 pl-3 border-l-2 border-emerald-200 bg-emerald-50/40 rounded-r-lg py-2 px-3">
            <div className="flex items-center gap-2">
              <Avatar
                src={seller.image}
                name={seller.fullName}
                size={22}
                rounded
              />
              <span className="text-xs font-semibold text-gray-900">
                {seller.fullName || seller.username || "Seller"}
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                Seller&apos;s response
              </span>
              <span className="ml-auto text-xs text-gray-500">
                {reply.repliedAt
                  ? moment(reply.repliedAt).format("D MMM YYYY")
                  : ""}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {reply.message}
            </p>
          </div>
        )}

        {/* Reply composer — only the gig's freelancer sees this and only
            until they've replied once. */}
        {!hasReply && isSellerViewer && (
          <div className="mt-3">
            {!composerOpen ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                <IoChatbubbleEllipsesOutline className="w-4 h-4" />
                Reply to this review
              </button>
            ) : (
              <form
                onSubmit={handleReply}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) =>
                    setReplyText(e.target.value.slice(0, MAX_REPLY))
                  }
                  placeholder="Thank the buyer, add context, or address feedback. You can only reply once."
                  className="w-full text-sm outline-none resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {replyText.length}/{MAX_REPLY}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setComposerOpen(false);
                        setReplyText("");
                      }}
                      className="text-xs px-2.5 py-1.5 rounded text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !replyText.trim()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      <IoSend className="w-3.5 h-3.5" />
                      {isLoading ? "Posting…" : "Post reply"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
