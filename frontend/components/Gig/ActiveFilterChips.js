"use client";
// Shows every currently-applied gig filter as a removable chip above
// the grid. Clicking a chip strips that one param; "Clear all" wipes
// the lot. State lives in the URL so this stays in lockstep with the
// FilterBar — both read/write the same URLSearchParams.

import { useRouter, useSearchParams } from "next/navigation";
import { IoClose } from "react-icons/io5";

const LEVEL_LABEL = {
  new: "New seller",
  level1: "Level 1",
  level2: "Level 2",
  topRated: "Top rated",
};

const DELIVERY_LABEL = {
  1: "Express 24h",
  3: "≤ 3 days",
  7: "≤ 7 days",
  14: "≤ 14 days",
};

export default function ActiveFilterChips() {
  const params = useSearchParams();
  const router = useRouter();

  const title = params.get("title");
  const categories = params.get("categories")?.split(",").filter(Boolean) || [];
  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");
  const delivery = params.get("delivery");
  const language = params.get("language");
  const country = params.get("country");
  const onlineOnly = params.get("online") === "true";
  const verifiedOnly = params.get("verifiedOnly") === "true";
  const minRating = params.get("minRating");
  const minGigRating = params.get("minGigRating");
  const minReviews = params.get("minReviews");
  const hasVideo = params.get("hasVideo") === "true";
  const level = params.get("level");

  const chips = [];
  if (title) chips.push({ keys: ["title"], label: `“${title}”` });
  for (const c of categories)
    chips.push({ kind: "cat", value: c, label: c });
  if (minPrice || maxPrice) {
    const lbl =
      minPrice && maxPrice
        ? `$${minPrice}–$${maxPrice}`
        : minPrice
        ? `$${minPrice}+`
        : `Up to $${maxPrice}`;
    chips.push({ keys: ["minPrice", "maxPrice"], label: lbl });
  }
  if (delivery)
    chips.push({
      keys: ["delivery"],
      label: DELIVERY_LABEL[delivery] || `≤ ${delivery} days`,
    });
  if (level)
    chips.push({ keys: ["level"], label: LEVEL_LABEL[level] || level });
  if (language) chips.push({ keys: ["language"], label: language });
  if (country) chips.push({ keys: ["country"], label: country });
  if (minRating) chips.push({ keys: ["minRating"], label: `${minRating}+ ★` });
  if (minGigRating) chips.push({ keys: ["minGigRating"], label: `Service ${minGigRating}+ ★` });
  if (minReviews) chips.push({ keys: ["minReviews"], label: `${minReviews}+ reviews` });
  if (hasVideo) chips.push({ keys: ["hasVideo"], label: "Has video" });
  if (onlineOnly) chips.push({ keys: ["online"], label: "Online sellers" });
  if (verifiedOnly)
    chips.push({ keys: ["verifiedOnly"], label: "Verified only" });

  if (chips.length === 0) return null;

  function setParams(mutate) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.push(`/gig?${next.toString()}`, { scroll: false });
  }

  function removeChip(chip) {
    setParams((p) => {
      if (chip.kind === "cat") {
        const remaining = categories.filter((c) => c !== chip.value);
        if (remaining.length) p.set("categories", remaining.join(","));
        else p.delete("categories");
      } else if (chip.keys) {
        chip.keys.forEach((k) => p.delete(k));
      }
    });
  }

  function clearAll() {
    router.push("/gig", { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-gray-500">Filters:</span>
      {chips.map((c, i) => (
        <button
          key={c.keys?.join(",") || `${c.kind}:${c.value}` || i}
          type="button"
          onClick={() => removeChip(c)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100"
        >
          {c.label}
          <IoClose className="w-3.5 h-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs text-gray-500 hover:text-gray-800 underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
