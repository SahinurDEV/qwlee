"use client";
// Seller-initiated extension request. Posts to /orders/:id/extension
// which both stores the request on the order AND drops a system bubble
// into the chat thread, so the buyer sees Accept/Decline inline.

import { useState } from "react";
import { Modal, DatePicker } from "antd";
import moment from "moment";
import { toast } from "sonner";
import { FaArrowRight } from "react-icons/fa6";

import { useRequestOrderExtensionMutation } from "@/app/redux/features/order/buyerOrderApi";

export default function ExtendDeliveryDateModal({
  isOpen,
  onClose,
  orderId,
  originalDeliveryDate,
}) {
  const [newDeliveryDate, setNewDeliveryDate] = useState(null);
  const [reason, setReason] = useState("");
  const [requestExtension, { isLoading }] = useRequestOrderExtensionMutation();

  const originalDate = moment(originalDeliveryDate);
  const minDate = originalDate.clone().add(1, "day");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newDeliveryDate || !newDeliveryDate.isAfter(originalDate, "day")) {
      toast.error("The new delivery date must be after the original date.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please give the buyer a reason for the extension.");
      return;
    }

    const res = await requestExtension({
      orderId,
      newDeliveryDate: newDeliveryDate.toDate().toISOString(),
      reason: reason.trim(),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't send the request");
      return;
    }
    toast.success("Extension request sent — waiting on the buyer.");
    setNewDeliveryDate(null);
    setReason("");
    onClose?.();
  }

  return (
    <Modal
      width={620}
      title={
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Request a delivery extension
          </h2>
          <p className="text-xs text-gray-500 font-normal mt-1">
            The buyer will be notified and can accept or decline.
          </p>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      centered
      footer={null}
      destroyOnClose
    >
      <form onSubmit={handleSubmit} className="pt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          New delivery date
        </label>
        <DatePicker
          value={newDeliveryDate}
          onChange={(date) => setNewDeliveryDate(date)}
          disabledDate={(current) => current && current.isBefore(minDate, "day")}
          format="D MMMM YYYY"
          className="w-full"
          size="large"
        />

        <div className="mt-5 flex items-center gap-5">
          <div className="flex-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Original
            </div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {originalDate.format("D MMM YYYY")}
            </div>
          </div>
          {newDeliveryDate && (
            <>
              <FaArrowRight className="text-emerald-600" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Requested
                </div>
                <div className="text-sm font-semibold text-emerald-700 mt-1">
                  {newDeliveryDate.format("D MMM YYYY")}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  +{newDeliveryDate.diff(originalDate, "days")} day
                  {newDeliveryDate.diff(originalDate, "days") === 1 ? "" : "s"}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reason for the extension
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            placeholder="Share why you need more time. Be specific — buyers are more likely to accept when the reason is clear."
            className="w-full rounded-lg border border-gray-200 outline-none p-3 resize-none text-sm focus:border-emerald-500"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {reason.length}/1000
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
          >
            {isLoading ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
