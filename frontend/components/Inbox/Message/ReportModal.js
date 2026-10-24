"use client";
// Report a conversation to the Qwlee team (goes to Admin → Risk flags).
import { useState } from "react";
import { Modal } from "antd";

const REASONS = [
  ["spam", "Spam or advertising"],
  ["scam", "Scam or fraud"],
  ["off-platform", "Asked to pay or talk outside Qwlee"],
  ["harassment", "Harassment or abuse"],
  ["inappropriate", "Inappropriate content"],
  ["other", "Something else"],
];

export default function ReportModal({ open, name, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Report ${name || "this member"}`}
      okText="Send report"
      okButtonProps={{ disabled: !reason || submitting, danger: true }}
      onOk={() => onSubmit({ reason, note, block })}
      centered
      destroyOnClose
      width={440}
    >
      <p className="text-sm text-gray-600 mb-3">Our team reviews every report. The member isn&rsquo;t told who reported them.</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Reason</legend>
        {REASONS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-note" className="block text-xs text-gray-600 mt-4 mb-1">Details (optional)</label>
      <textarea
        id="report-note"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        rows={3}
        className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
        placeholder="What happened?"
      />
      <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        Also block this conversation
      </label>
    </Modal>
  );
}
