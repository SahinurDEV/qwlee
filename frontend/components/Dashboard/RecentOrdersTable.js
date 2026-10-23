"use client";
// Compact recent-orders table used by both dashboards. Caller passes
// the merged orders array + a label ("Client" / "Freelancer") for the
// counterparty column.

import Link from "next/link";
import moment from "moment";
import ImageWithFallback from "@/components/common/ImageWithFallback";

const STATUS_TONE = {
  active: "bg-sky-50 text-sky-700 border-sky-100",
  late: "bg-amber-50 text-amber-700 border-amber-100",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-rose-50 text-rose-700 border-rose-100",
};

function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export default function RecentOrdersTable({
  orders = [],
  counterpartyLabel = "Client",
  counterpartyKey = "clientId",
  loading = false,
  emptyLabel = "No recent orders yet.",
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="text-sm text-gray-500">Loading orders…</div>
      </div>
    );
  }
  if (!orders.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <ul className="md:hidden divide-y divide-gray-100">
        {orders.slice(0, 6).map((o) => {
          const title = o?.items?.[0]?.name || o?.gigId?.title || "Gig";
          const counterparty = o?.[counterpartyKey];
          const price = o?.items?.[0]?.price ?? o?.price ?? 0;
          const status = o?.status || "active";
          return (
            <li key={o._id || o.id}>
              <Link href={`/order/${o._id || o.id}`} className="flex gap-3 p-3 active:bg-gray-50">
                <div className="relative shrink-0 w-12 h-12 rounded-md overflow-hidden bg-gray-100">
                  <ImageWithFallback src={o?.gigId?.images?.[0]} name={title} fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 line-clamp-1">{title}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {counterparty?.fullName || "—"} · {o?.deliveryDate ? moment(o.deliveryDate).fromNow() : "—"}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_TONE[status] || "bg-gray-50 text-gray-700 border-gray-100"}`}>
                      {capitalise(status)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">${Number(price).toFixed(0)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-3">Gig</th>
              <th className="text-left font-medium px-4 py-3">{counterpartyLabel}</th>
              <th className="text-left font-medium px-4 py-3">Price</th>
              <th className="text-left font-medium px-4 py-3">Due</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.slice(0, 6).map((o) => {
              const title = o?.items?.[0]?.name || o?.gigId?.title || "Gig";
              const image = o?.gigId?.images?.[0];
              const counterparty = o?.[counterpartyKey];
              const price = o?.items?.[0]?.price ?? o?.price ?? 0;
              const due = o?.deliveryDate
                ? moment(o.deliveryDate).fromNow()
                : "—";
              const status = o?.status || "active";
              return (
                <tr key={o._id || o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="relative shrink-0 w-12 h-12 rounded-md overflow-hidden bg-gray-100">
                        <ImageWithFallback
                          src={image}
                          name={title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-gray-900 line-clamp-1">
                          {title}
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-1">
                          {o?.data?.packageName || "Custom order"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {counterparty?.username ? (
                      <Link
                        href={`/${counterparty.username}`}
                        className="hover:text-emerald-700"
                      >
                        {counterparty?.fullName || `@${counterparty.username}`}
                      </Link>
                    ) : (
                      counterparty?.fullName || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${Number(price).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{due}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_TONE[status] ||
                        "bg-gray-50 text-gray-700 border-gray-100"
                      }`}
                    >
                      {capitalise(status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
