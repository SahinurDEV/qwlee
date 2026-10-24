// Seller level shown on cards. Same thresholds as the search "Seller
// level" filter (backend gig.service LEVEL_RULES), so a badge always
// matches the filter that finds it.
export function sellerLevel(seller) {
  const rating = Number(seller?.review?.rating || 0);
  const total = Number(seller?.review?.total || 0);
  if (total >= 2 && rating >= 4.8) return { id: "topRated", label: "Top Rated" };
  if (total >= 2 && rating >= 4.5) return { id: "level2", label: "Level 2" };
  if (total >= 2 && rating >= 4.0) return { id: "level1", label: "Level 1" };
  if (total <= 1) return { id: "new", label: "New seller" };
  return null;
}
