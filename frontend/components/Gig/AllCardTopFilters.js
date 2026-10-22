"use client";
// Top strip above gig results: result count + working sort dropdown.
// Sort writes to the URL so the parent Gig component can pass `sortBy`
// to the backend (/v1/gig already honors sortBy via the controller's
// pick(['sortBy','limit','page','populate'])).

import { Select } from "antd";
import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "rating.avg:desc,rating.count:desc", label: "Best rated" },
  { value: "ordersCompleted:desc", label: "Best selling" },
  { value: "price:asc", label: "Price: low to high" },
  { value: "price:desc", label: "Price: high to low" },
  { value: "title:asc", label: "Title: A → Z" },
];

const AllCardTopFilters = ({ totalResults }) => {
  const params = useSearchParams();
  const router = useRouter();
  const current = params.get("sortBy") || "createdAt:desc";

  function handleChange(value) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("sortBy", value);
    else next.delete("sortBy");
    router.push(`/gig?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{totalResults ?? 0}</span>{" "}
        results
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span className="text-gray-500">Sort by</span>
        <Select
          aria-label="Sort services"
          value={current}
          onChange={handleChange}
          options={OPTIONS}
          className="w-[170px] md:w-[200px]"
          size="middle"
        />
      </div>
    </div>
  );
};

export default AllCardTopFilters;
