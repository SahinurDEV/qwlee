"use client";
// Homepage "Recently viewed" / "Pick up where you left off" strip.
//
// - Pulls from localStorage; renders nothing for first-time visitors.
// - Hidden entirely while the user is in Selling mode — sellers don't
//   need a buyer-side history teaser on their homepage.
// - Caps to a single row (4 cards) so it stays a small re-entry hint
//   rather than another grid competing with the marketplace.

import { useI18n } from "@/components/Context/I18nProvider";
import Link from "next/link";
import { GoX } from "react-icons/go";
import useRecentlyViewed from "@/hooks/useRecentlyViewed";
import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import ImageWithFallback from "@/components/common/ImageWithFallback";

const MAX_ITEMS = 4; // one row on desktop (xl:grid-cols-4)

export default function RecentlyViewedGigs() {
  const { t } = useI18n();
  const { items, clear } = useRecentlyViewed();
  const user = useUser();
  const { isSelling } = useViewMode(user);

  if (isSelling && !!user) return null;
  if (!items || items.length === 0) return null;

  const visible = items.slice(0, MAX_ITEMS);

  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-5 md:mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              {t("Recently viewed")}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              Pick up where you left off.
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-xs md:text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            aria-label="Clear recently viewed"
          >
            <GoX /> Clear
          </button>
        </div>

        {/* One row of up to 4 cards. Grid wraps responsively but the
            MAX_ITEMS cap keeps the section short. */}
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {visible.map((g) => (
            <li key={g.id}>
              <Link
                href={`/gig/${g.slug || g.id}`}
                className="group block bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition overflow-hidden h-full"
              >
                <div className="relative w-full aspect-[4/3] bg-gray-100">
                  <ImageWithFallback
                    src={g.image}
                    name={g.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 320px"
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5rem] group-hover:text-emerald-700">
                    {g.title || "Untitled gig"}
                  </h3>
                  {g.sellerName ? (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {g.sellerUsername ? `@${g.sellerUsername}` : g.sellerName}
                    </div>
                  ) : null}
                  {g.price > 0 ? (
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      From ${g.price}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
