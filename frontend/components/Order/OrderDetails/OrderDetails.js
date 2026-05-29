"use client";
// Order detail page — Qwlee/Fiverr-style.
//
// One viewer (buyer or seller) sees the same screen with role-appropriate
// actions. Backend exposes the order at /v1/orders/:id (resolved via the
// Payment collection — items[0].price is the order amount), and the
// thread at /v1/order-message?orderId=.
//
// Layout:
//   - status header (pill + order #, ordered date, breadcrumbs)
//   - 8/4 grid: order summary + activity on the left, sticky action
//     panel on the right
//
// Loading + error states are handled here so the children can assume the
// data exists.

import Link from "next/link";
import { IoArrowBack } from "react-icons/io5";
import moment from "moment";

import { useGetBuyerOrderDetailsQuery } from "@/app/redux/features/order/buyerOrderApi";
import useUser from "@/hooks/useUser";

import OrderSummary from "./OrderLeftSide/OrderLeftSide";
import OrderActions from "./OrderRightSide/OrderRightSide";

const STATUS_STYLE = {
  active:    { label: "In progress", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  delivered: { label: "Delivered",   dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-700 border-sky-100" },
  completed: { label: "Completed",   dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  late:      { label: "Late",        dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 border-rose-100" },
  cancelled: { label: "Cancelled",   dot: "bg-gray-400",    chip: "bg-gray-100 text-gray-700 border-gray-200" },
  disputed:  { label: "Disputed",    dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 border-rose-100" },
};

export default function OrderDetails({ orderId }) {
  const user = useUser();
  const { data: order, isLoading, isError } = useGetBuyerOrderDetailsQuery(orderId, {
    skip: !orderId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-100 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-3">
              <div className="h-44 bg-gray-100 rounded-2xl" />
              <div className="h-72 bg-gray-100 rounded-2xl" />
            </div>
            <div className="md:col-span-4 h-72 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
          We couldn&rsquo;t find this order
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          It may have been removed, or the link is incorrect.
        </p>
        <Link
          href="/order"
          className="inline-flex items-center gap-1 mt-5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          <IoArrowBack /> Back to orders
        </Link>
      </div>
    );
  }

  const status = STATUS_STYLE[order.status] || STATUS_STYLE.active;
  const orderedAt = order.createdAt ? moment(order.createdAt).format("D MMM YYYY") : "—";
  const shortId = String(order.id || order._id || "").slice(-8).toUpperCase();
  const isSeller = !!user && String(order.freelancerId?.id || order.freelancerId?._id) === String(user.id || user._id);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <Link
            href="/order"
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-1"
          >
            <IoArrowBack /> Back to orders
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Order #{shortId}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.chip}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Ordered on {orderedAt}
            {order.items?.[0]?.price ? (
              <>
                {" · "}
                <span className="text-gray-700 font-medium">
                  ${Number(order.items[0].price).toFixed(2)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          <OrderSummary order={order} orderId={orderId} isSeller={isSeller} />
        </div>
        <div className="md:col-span-4">
          <div className="md:sticky md:top-20">
            <OrderActions order={order} orderId={orderId} isSeller={isSeller} />
          </div>
        </div>
      </div>
    </div>
  );
}
