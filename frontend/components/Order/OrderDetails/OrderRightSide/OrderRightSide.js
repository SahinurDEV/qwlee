"use client";
// Right-rail action panel on the order detail page.
//
// What it shows depends on viewer + status:
//   - Seller + active/late: countdown card with "Deliver Now" + "Extend"
//   - Seller + delivered/cancelled: status banner
//   - Buyer always: order summary card (gig, ordered by, dates)
//   - Buyer + delivered: "Mark as completed" + "Leave a review" actions
//
// We intentionally keep the chat composer in Activity and the "Accept
// delivery" CTA inside the delivery message bubble — those map to the
// place in the page where the buyer is already looking.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { toast } from "sonner";
import { IoTimeOutline, IoAlertCircle, IoCheckmarkCircle } from "react-icons/io5";

import {
  useGetBuyerOrderDetailsQuery,
  useUpdateBuyerOrderStatusMutation,
  useRespondOrderExtensionMutation,
} from "@/app/redux/features/order/buyerOrderApi";
import { useSendOrderMessageMutation } from "@/app/redux/features/orderMessage/orderMessage.api";
import { useGetReviewByOrderQuery } from "@/app/redux/features/reviewsApi";
import DeliverNowModal from "./DeliveryModal";
import ExtendDeliveryDateModal from "./ExtendDeliveryDateModal";
import LeaveReviewModal from "./LeaveReviewModal";
import OpenDisputeModal from "./OpenDisputeModal";
import { IoStar, IoCalendarOutline, IoFlagOutline } from "react-icons/io5";

export default function OrderActions({ order, orderId, isSeller }) {
  const router = useRouter();
  const [sendOrderMessage] = useSendOrderMessageMutation();
  const [updateOrder] = useUpdateBuyerOrderStatusMutation();
  // Fetch once at the top — but we already have `order` from the parent.
  // Keep the hook tree consistent by re-using the same query (RTK Query
  // dedupes; this won't fire a second network request).
  useGetBuyerOrderDetailsQuery(orderId, { skip: !orderId });

  // Has the buyer already reviewed this order? Drives the
  // Leave-vs-Your-review UI in the buyer action panel.
  const { data: myReview } = useGetReviewByOrderQuery(orderId, {
    skip: !orderId || isSeller,
  });

  const [respondExtension, { isLoading: extLoading }] =
    useRespondOrderExtensionMutation();
  const extension = order?.extensionRequest;
  const extensionPending = extension?.status === "pending";

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLate, setIsLate] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const calc = useCallback(() => {
    const target = moment(order?.deliveryDate);
    const diff = target.diff(moment());
    if (!order?.deliveryDate || diff <= 0) {
      setIsLate(true);
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    setIsLate(false);
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [order?.deliveryDate]);

  useEffect(() => {
    setTimeLeft(calc());
    const id = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);

  const status = order?.status;
  const formattedDelivery = order?.deliveryDate
    ? moment(order.deliveryDate).format("D MMM YYYY")
    : "—";

  async function handleDeliverSubmit({ deliveryMessage, files }) {
    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("deliveryMessage", deliveryMessage);
    formData.append("receiver", order?.clientId?.id || order?.clientId?._id);
    (files || []).forEach((f) => formData.append("files", f));
    const res = await sendOrderMessage(formData);
    if (res.error) {
      toast.error(res.error?.data?.message || "Could not deliver");
      return;
    }
    toast.success("Delivery sent");
    setDeliverOpen(false);
  }

  async function handleMarkComplete() {
    const res = await updateOrder({ orderId, status: "delivered" });
    if (res.error) toast.error(res.error?.data?.message || "Could not update");
    else toast.success("Order marked as complete");
  }

  async function handleCancelOrder() {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    const res = await updateOrder({ orderId, status: "cancelled" });
    if (res.error) toast.error(res.error?.data?.message || "Could not cancel");
    else toast.success("Order cancelled");
  }

  async function handleExtensionResponse(action) {
    const res = await respondExtension({ orderId, action });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't respond");
      return;
    }
    toast.success(
      action === "accept" ? "Extension accepted" : "Extension declined"
    );
  }

  return (
    <div className="space-y-4">
      {/* Countdown — sellers only, while in-flight */}
      {isSeller && (status === "active" || status === "late") && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <IoTimeOutline className={isLate ? "text-rose-500" : "text-emerald-600"} />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {isLate ? "Delivery is late" : "Time left to deliver"}
            </h3>
          </div>
          <CountdownGrid timeLeft={timeLeft} isLate={isLate} />
          <button
            type="button"
            onClick={() => setDeliverOpen(true)}
            disabled={status === "cancelled"}
            className="mt-4 w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Deliver now
          </button>
          <button
            type="button"
            onClick={() => setExtendOpen(true)}
            disabled={extensionPending}
            className="mt-2 w-full text-center text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extensionPending ? "Extension pending…" : "Extend delivery date"}
          </button>
        </section>
      )}

      {/* Status banner when not actionable */}
      {status === "delivered" && (
        <section className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 text-center">
          <IoCheckmarkCircle className="text-emerald-600 w-7 h-7 mx-auto" />
          <h3 className="text-sm font-semibold text-emerald-800 mt-1">
            Order delivered
          </h3>
          <p className="text-xs text-emerald-700 mt-1">
            {isSeller
              ? "Waiting for the buyer to accept the delivery."
              : "Take a moment to review the work and accept the delivery."}
          </p>
        </section>
      )}

      {status === "cancelled" && (
        <section className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
          <IoAlertCircle className="text-gray-500 w-7 h-7 mx-auto" />
          <h3 className="text-sm font-semibold text-gray-800 mt-1">Order cancelled</h3>
        </section>
      )}

      {status === "disputed" && (
        <section className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 text-center">
          <IoFlagOutline className="text-rose-600 w-7 h-7 mx-auto" />
          <h3 className="text-sm font-semibold text-rose-800 mt-1">
            Dispute opened
          </h3>
          <p className="text-xs text-rose-700 mt-1">
            The order is paused while the parties try to reach a resolution.
          </p>
        </section>
      )}

      {/* Pending extension card — both parties see the request, but
          only the buyer gets Accept/Decline. */}
      {extensionPending && (
        <section className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <IoCalendarOutline className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">
              Extension requested
            </h3>
          </div>
          <p className="text-xs text-amber-800 mt-2">
            New delivery date:{" "}
            <strong>
              {moment(extension.newDeliveryDate).format("D MMM YYYY")}
            </strong>
          </p>
          {extension.reason ? (
            <p className="text-xs text-amber-800/90 mt-1.5 leading-relaxed line-clamp-4">
              “{extension.reason}”
            </p>
          ) : null}

          {!isSeller ? (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                disabled={extLoading}
                onClick={() => handleExtensionResponse("accept")}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={extLoading}
                onClick={() => handleExtensionResponse("decline")}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold border border-amber-300 text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-700/80 mt-3 italic">
              Waiting for the buyer to respond…
            </p>
          )}
        </section>
      )}

      {/* Summary */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Summary
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label={isSeller ? "Ordered by" : "Seller"}>
            <span className="text-gray-900 font-medium">
              {isSeller
                ? order?.clientId?.fullName || order?.clientId?.username || "Buyer"
                : order?.freelancerId?.fullName || order?.freelancerId?.username || "Seller"}
            </span>
          </Row>
          <Row label="Order date">
            <span className="text-gray-900">
              {order?.createdAt ? moment(order.createdAt).format("D MMM YYYY") : "—"}
            </span>
          </Row>
          <Row label="Delivery date">
            <span className="text-gray-900">{formattedDelivery}</span>
          </Row>
          <Row label="Total">
            <span className="text-gray-900 font-semibold">
              ${Number(order?.items?.[0]?.price || order?.price || 0).toFixed(2)}
            </span>
          </Row>
        </dl>
      </section>

      {/* Buyer actions */}
      {!isSeller && status === "delivered" && !myReview && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Rate your experience
          </h3>
          <p className="text-xs text-gray-500">
            Help future buyers — leave a review for this delivery.
          </p>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Leave a review
          </button>
        </section>
      )}
      {!isSeller && myReview && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Your review
          </h3>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <IoStar
                key={i}
                className={
                  i < Math.round(Number(myReview.rating || 0))
                    ? "text-amber-500"
                    : "text-gray-200"
                }
              />
            ))}
            <span className="ml-1 font-medium text-gray-900">
              {Number(myReview.rating || 0).toFixed(1)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed line-clamp-4">
            “{myReview.review}”
          </p>
          {myReview.sellerReply?.message ? (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Seller&apos;s response
              </div>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed line-clamp-4">
                {myReview.sellerReply.message}
              </p>
            </div>
          ) : null}
        </section>
      )}
      {!isSeller && (status === "active" || status === "late") && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
          <button
            type="button"
            onClick={handleCancelOrder}
            className="w-full px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50"
          >
            Request cancellation
          </button>
        </section>
      )}

      {["active", "late", "delivered"].includes(status) && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <button
            type="button"
            onClick={() => setDisputeOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-medium hover:bg-rose-50"
          >
            <IoFlagOutline /> Open a dispute
          </button>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            Pauses the order and notifies the other party.
          </p>
        </section>
      )}

      <DeliverNowModal
        isOpen={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        onSubmit={handleDeliverSubmit}
      />
      <ExtendDeliveryDateModal
        isOpen={extendOpen}
        onClose={() => setExtendOpen(false)}
        orderId={orderId}
        originalDeliveryDate={order?.deliveryDate}
      />
      <LeaveReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        order={order}
      />
      <OpenDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        orderId={orderId}
        viewerRole={isSeller ? "freelancer" : "buyer"}
      />
    </div>
  );
}

function CountdownGrid({ timeLeft, isLate }) {
  const cells = [
    { label: "Days", value: timeLeft.days },
    { label: "Hrs", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg py-3 text-center ${
            isLate ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-gray-50 border border-gray-100"
          }`}
        >
          <div className={`text-xl font-bold ${isLate ? "text-rose-700" : "text-gray-900"}`}>
            {String(c.value || 0).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
        {label}
      </dt>
      <dd className="text-right truncate">{children}</dd>
    </div>
  );
}
