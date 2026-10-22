"use client";
// Pure presentational grid of gigs. The sort dropdown + count strip
// previously lived in here too — that caused it to render twice (parent
// Gig.js also rendered AllCardTopFilters). Now this component just
// renders cards; sort/count belong to the parent.

import GigCard from "../common/GigCard";

export default function AllCard({ data, sponsored = false }) {
  if (!data?.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
      {data.map((item) => (
        <GigCard key={item._id || item.id} item={item} sponsored={sponsored} />
      ))}
    </div>
  );
}
