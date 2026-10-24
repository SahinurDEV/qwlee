// Seller level shown on badges. The server stores it on the seller
// (user.sellerLevel, from the admin-set level criteria), the same field the
// search "Seller level" filter uses, so a badge always matches the filter.
const LABEL = { new: "New seller", level1: "Level 1", level2: "Level 2", topRated: "Top Rated" };

export function sellerLevel(seller) {
  const s = seller?.sellerLevel;
  if (!s?.id) return null;
  const id = s.id === "level0" ? "new" : s.id;
  return { id, label: s.label || LABEL[id] || id };
}
