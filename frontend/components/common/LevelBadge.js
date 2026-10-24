import { sellerLevel } from "@/utils/sellerLevel";

const TONE = {
  topRated: "bg-amber-100 text-amber-800 border-amber-200",
  level2: "bg-emerald-50 text-emerald-700 border-emerald-200",
  level1: "bg-sky-50 text-sky-700 border-sky-200",
  new: "bg-gray-50 text-gray-600 border-gray-200",
};

// Small pill with the seller's level. Pass `seller` (with review) or a
// precomputed `level` ({ id, label }).
export default function LevelBadge({ seller, level, className = "" }) {
  const l = level || sellerLevel(seller);
  if (!l) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[l.id] || TONE.new} ${className}`}
      title={`Seller level: ${l.label}`}
    >
      {l.id === "topRated" ? "★ " : ""}
      {l.label}
    </span>
  );
}
