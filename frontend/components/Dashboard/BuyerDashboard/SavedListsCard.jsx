"use client";
// Buyer dashboard: saved collections + a link to browsing history.
import Link from "next/link";
import { IoHeartOutline, IoTimeOutline, IoChevronForward } from "react-icons/io5";
import { useGetCollectionsQuery } from "@/app/redux/features/collectionsApi";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import useRecentlyViewed from "@/hooks/useRecentlyViewed";

export default function SavedListsCard({ user }) {
  const { data: lists = [], isLoading } = useGetCollectionsQuery(undefined, { skip: !user });
  const { items: recent } = useRecentlyViewed();
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Saved lists</h2>
        <Link href="/list" className="inline-flex items-center min-h-[44px] text-sm font-medium text-emerald-700 hover:text-emerald-800">All saved →</Link>
      </div>
      {isLoading ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          Tap <IoHeartOutline className="inline -mt-0.5" aria-label="the heart" /> on any gig to save it here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lists.slice(0, 5).map((l) => (
            <li key={l.name || "saved"}>
              <Link href={`/list?collection=${encodeURIComponent(l.name || "")}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-gray-50">
                <div className="relative w-12 h-9 shrink-0 rounded-md overflow-hidden bg-gray-100">
                  <ImageWithFallback src={l.cover} name={l.name || "Saved"} fill sizes="48px" className="object-cover" alt="" />
                </div>
                <span className="flex-1 min-w-0 truncate text-sm text-gray-900">{l.name || "Saved"}</span>
                <span className="text-xs text-gray-500">{l.count}</span>
                <IoChevronForward className="text-gray-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <hr className="my-4 border-gray-100" />
      <Link href="/history" className="flex items-center gap-2 min-h-[44px] text-sm text-gray-800 hover:text-emerald-700">
        <IoTimeOutline aria-hidden /> Browsing history
        <span className="ml-auto text-xs text-gray-500">{recent.length ? `${recent.length} viewed` : ""}</span>
      </Link>
    </div>
  );
}
