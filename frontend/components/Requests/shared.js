"use client";
import Link from "next/link";

export const idOf = (v) => String(v?.id || v?._id || v || "");
export const errMsg = (res, fallback) => res?.error?.data?.message || fallback;

export const STATUS_STYLES = {
  open: "bg-emerald-50 text-emerald-700",
  hired: "bg-blue-50 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
  pending: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-gray-100 text-gray-600",
  withdrawn: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[status] || "bg-gray-100"}`}>
      {status}
    </span>
  );
}

export function RequestsNav({ active }) {
  const tabs = [
    { href: "/requests", key: "board", label: "Browse requests" },
    { href: "/requests/mine", key: "mine", label: "My requests & offers" },
    { href: "/requests/new", key: "new", label: "Post a request" },
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-4 py-2 rounded-full text-sm font-medium border ${
            active === t.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function RequestMeta({ request }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
      <span>Budget: <b className="text-gray-900">${request.budget}</b></span>
      <span>Delivery: <b className="text-gray-900">{request.deliveryDays} days</b></span>
      {request.categoriesId?.name && <span>{request.categoriesId.name}{request.subCategoryId?.name ? ` › ${request.subCategoryId.name}` : ""}</span>}
      <span>{request.offersCount || 0} offers</span>
    </div>
  );
}
