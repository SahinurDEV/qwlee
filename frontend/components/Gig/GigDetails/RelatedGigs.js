"use client";
// Rows of gig cards under the gig page: "More from <seller>" and
// "People also viewed". Horizontal scroll on phones, grid on desktop.
import { baseApi } from "@/app/redux/api/baseApi";
import GigCard from "@/components/common/GigCard";

const relatedApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getRelatedGigs: b.query({
      query: (gigId) => `/gig/${gigId}/related`,
      transformResponse: (r) => r?.data?.attributes || {},
    }),
  }),
});

export function GigRow({ title, gigs }) {
  if (!gigs?.length) return null;
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 -mx-4 px-4 flex gap-4 overflow-x-auto snap-x pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible">
        {gigs.slice(0, 8).map((g) => (
          <div key={g._id || g.id} className="snap-start shrink-0 w-[260px] md:w-auto">
            <GigCard item={g} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RelatedGigs({ gigId, sellerName }) {
  const { data } = relatedApi.useGetRelatedGigsQuery(gigId, { skip: !gigId });
  if (!data) return null;
  const first = (sellerName || "this seller").split(" ")[0];
  return (
    <>
      <GigRow title={`More from ${first}`} gigs={data.moreFromSeller} />
      <GigRow
        title={data.alsoViewedSource === "views" ? "People also viewed" : "You may also like"}
        gigs={data.alsoViewed}
      />
    </>
  );
}
