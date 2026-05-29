"use client";
import { useState } from "react";
import { Modal } from "antd";
import { toast } from "sonner";
import { useOpenDisputeMutation } from "@/app/redux/features/order/disputeApi";

const BUYER_REASONS = [
  { value: "not_as_described", label: "Service was not as described" },
  { value: "low_quality", label: "Low quality of work" },
  { value: "late_delivery", label: "Delivery was late" },
  { value: "no_delivery", label: "Seller did not deliver" },
  { value: "other", label: "Other" },
];

const SELLER_REASONS = [
  { value: "buyer_unresponsive", label: "Buyer is unresponsive" },
  { value: "scope_creep", label: "Scope creep / out-of-scope requests" },
  { value: "abusive_behavior", label: "Abusive behavior" },
  { value: "other", label: "Other" },
];

export default function OpenDisputeModal({ open, onClose, orderId, viewerRole }) {
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [openDispute, { isLoading }] = useOpenDisputeMutation();

  const reasons = viewerRole === "freelancer" ? SELLER_REASONS : BUYER_REASONS;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reasonCode) return toast.error("Pick a reason");
    if (description.trim().length < 20) {
      return toast.error("Please describe the issue (20+ characters)");
    }
    const res = await openDispute({ orderId, reasonCode, description });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not open dispute");
      return;
    }
    toast.success("Dispute opened. The other party has 72 hours to respond.");
    setReasonCode("");
    setDescription("");
    onClose();
  }

  return (
    <Modal
      width={600}
      open={open}
      onCancel={onClose}
      centered
      footer={null}
      title={<span className="text-lg font-semibold">Open a dispute</span>}
    >
      <p className="text-sm text-gray-500 -mt-2 mb-4">
        Disputes pause the order. The other party will be notified and can
        respond within 72 hours. If you can&rsquo;t reach an agreement, you can
        escalate to an admin.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            Reason
          </label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            What happened?
          </label>
          <textarea
            rows={5}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the issue with specifics — what was expected, what was delivered, dates…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
          />
          <div className="text-[11px] text-gray-400 mt-1 text-right">
            {description.length}/2000
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {isLoading ? "Opening…" : "Open dispute"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
