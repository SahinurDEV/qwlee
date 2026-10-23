"use client";
// Marketplace gig card.
// - Title-driven link (`/gig/<slug>`)
// - ImageWithFallback so missing media degrades gracefully
// - Avatar for the seller chip (initials fallback if no image)
// - Normalised skill rendering (string or {id, text})
// - Wishlist heart overlay (any signed-in user can save)
// - Hover lift to match the rest of the Qwlee card system

import { useI18n } from "@/components/Context/I18nProvider";
import Money from "@/components/common/Money";
import Link from "next/link";
import { IoStar } from "react-icons/io5";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import Avatar from "@/components/common/Avatar";
import VerifiedBadge from "@/components/common/VerifiedBadge";
import useWishlist from "@/hooks/useWishlist";
import { baseUrl } from "@/lib/constant";

function normaliseSkills(skills) {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((s) => (typeof s === "string" ? s : s?.text || s?.name || ""))
    .filter(Boolean);
}

export default function GigCard({ item, sponsored = false }) {
  const { t } = useI18n();
  if (!item) return null;
  const seller = item.userId || {};
  const skillList = normaliseSkills(seller.skills).slice(0, 3);
  const slugOrId = item.slug || item._id || item.id;
  const gigId = item._id || item.id;

  const { isLoved, toggle } = useWishlist();
  const loved = isLoved(gigId);

  function handleHeart(e) {
    // Card root is an anchor — stop the click bubbling to the link.
    e.preventDefault();
    e.stopPropagation();
    toggle(gigId);
  }

  return (
    <div
      className="group relative flex flex-col bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition overflow-hidden h-full"
      onClickCapture={sponsored ? () => {
        // Count the sponsored click; never blocks navigation.
        try { navigator.sendBeacon?.(`${baseUrl}/promotions/click/${gigId}`); } catch {}
      } : undefined}
    >
      <button
        type="button"
        onClick={handleHeart}
        aria-label={loved ? "Remove from wishlist" : "Save to wishlist"}
        aria-pressed={loved}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-200 flex items-center justify-center hover:bg-white hover:scale-105 transition"
      >
        {loved ? (
          <FaHeart className="text-rose-500 w-4 h-4" />
        ) : (
          <FaRegHeart className="text-gray-700 w-4 h-4" />
        )}
      </button>

      <Link href={`/gig/${slugOrId}`} className="flex flex-col h-full">
        <div className="relative w-full aspect-[16/10] bg-gray-100">
          <ImageWithFallback
            src={item?.images?.[0]}
            name={item?.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            alt={item?.title || "gig"}
          />
          {sponsored ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-gray-900/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
              Sponsored
            </span>
          ) : item?.featured ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gray-900 shadow-sm">
              Featured
            </span>
          ) : null}
        </div>

        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Avatar
                src={seller.image}
                name={seller.fullName}
                size={32}
                rounded
              />
              {seller.online && (
                <span
                  aria-label="Online"
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate inline-flex items-center gap-1">
                <span className="truncate">{seller.fullName || "Seller"}</span>
                <VerifiedBadge user={seller} size={12} />
              </div>
              {seller.username ? (
                <div className="text-xs text-gray-500 truncate">
                  @{seller.username}
                </div>
              ) : null}
            </div>
            {seller?.review?.total > 0 ? (
              <div className="flex items-center gap-0.5 text-xs">
                <IoStar className="text-amber-500" />
                <span className="font-medium text-gray-900">
                  {Number(seller.review.rating).toFixed(1)}
                </span>
                <span className="text-gray-400">({seller.review.total})</span>
              </div>
            ) : null}
          </div>

          <h3 className="mt-3 text-sm md:text-[15px] text-gray-900 line-clamp-2 min-h-[2.5rem] group-hover:text-emerald-700">
            {item.title}
          </h3>

          {skillList.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skillList.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">{t("startingAt")}</span>
            <Money usd={item.price} className="text-gray-900 font-semibold" />
          </div>
        </div>
      </Link>
    </div>
  );
}
