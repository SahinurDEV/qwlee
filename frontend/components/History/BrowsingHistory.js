"use client";
// Gigs viewed on this device (localStorage), grouped by day.
import Link from "next/link";
import moment from "moment";
import { IoCloseOutline, IoTimeOutline } from "react-icons/io5";
import useRecentlyViewed from "@/hooks/useRecentlyViewed";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import Money from "@/components/common/Money";
import { confirmModal } from "@/components/common/confirm";

const dayLabel = (t) => {
  const m = moment(t);
  if (m.isSame(moment(), "day")) return "Today";
  if (m.isSame(moment().subtract(1, "day"), "day")) return "Yesterday";
  return m.format("ddd, MMM D");
};

export default function BrowsingHistory() {
  const { items, remove, clear } = useRecentlyViewed();
  const groups = [];
  for (const it of items) {
    const label = dayLabel(it.viewedAt);
    const g = groups.find((x) => x.label === label);
    g ? g.items.push(it) : groups.push({ label, items: [it] });
  }
  const clearAll = async () => {
    const ok = await confirmModal({ title: "Clear browsing history?", description: "This removes the gigs you viewed on this device.", confirmText: "Clear history", danger: true });
    if (ok) clear();
  };
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Browsing history</h1>
          <p className="text-sm text-gray-500 mt-1">Gigs you opened on this device, newest first.</p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={clearAll} className="text-sm text-gray-600 hover:text-rose-600 underline-offset-2 hover:underline">
            Clear history
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mt-10 text-center rounded-2xl border border-dashed border-gray-200 p-10">
          <IoTimeOutline className="mx-auto text-3xl text-gray-300" aria-hidden />
          <p className="mt-2 text-gray-600">Nothing here yet.</p>
          <Link href="/gig" className="mt-4 inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">Browse services</Link>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{g.label}</h2>
            <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
              {g.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 p-3">
                  <Link href={`/gig/${it.slug || it.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                    <div className="relative w-20 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <ImageWithFallback src={it.image} name={it.title} fill sizes="80px" className="object-cover" alt={it.title || "Gig"} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900 line-clamp-2 group-hover:text-emerald-700">{it.title}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {it.sellerName ? `${it.sellerName} · ` : ""}{moment(it.viewedAt).format("h:mm A")}
                      </div>
                    </div>
                  </Link>
                  <Money usd={it.price} className="text-sm font-semibold text-gray-900 shrink-0 hidden sm:block" />
                  <button type="button" onClick={() => remove(it.id)} aria-label={`Remove ${it.title} from history`} className="p-2 text-gray-400 hover:text-rose-600 shrink-0">
                    <IoCloseOutline />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
