"use client";
// Homepage "Recommended for you": gigs like the ones the visitor saved,
// ordered or recently viewed (best rated first); popular gigs otherwise.
import { useI18n } from "@/components/Context/I18nProvider";
import useRecentlyViewed from "@/hooks/useRecentlyViewed";
import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import GigCard from "@/components/common/GigCard";
import { useGetRecommendedQuery } from "@/app/redux/features/collectionsApi";

export default function RecommendedGigs() {
  const { t } = useI18n();
  const { items } = useRecentlyViewed();
  const user = useUser();
  const { isSelling } = useViewMode(user);
  const seen = (items || []).map((g) => g.id || g._id).filter((x) => /^[a-f0-9]{24}$/.test(String(x)));
  const { data } = useGetRecommendedQuery({ seen }, { skip: isSelling && !!user });
  const gigs = (data?.results || []).slice(0, 4);
  if ((isSelling && !!user) || gigs.length === 0) return null;
  return (
    <section className="py-10 md:py-14" aria-labelledby="rec-h">
      <div className="container mx-auto px-4">
        <h2 id="rec-h" className="text-xl md:text-2xl font-bold text-gray-900">
          {t(data?.personal ? "Recommended for you" : "Popular right now")}
        </h2>
        <p className="text-gray-500 mt-1 text-sm mb-5 md:mb-6">
          {data?.personal ? "Based on gigs you saved, ordered or viewed." : "Top-rated services on Qwlee."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          {gigs.map((g) => (
            <GigCard key={g.id || g._id} item={g} />
          ))}
        </div>
      </div>
    </section>
  );
}
