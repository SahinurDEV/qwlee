"use client";
// Fiverr-style tip after completion: $5 minimum; up to $25 on orders
// under $25, otherwise up to the order price. Open for 30 days.
import { useState } from "react";
import { toast } from "sonner";
import { IoHeartOutline } from "react-icons/io5";
import { useTipOrderMutation } from "@/app/redux/features/order/buyerOrderApi";

export default function TipCard({ order, orderId }) {
  const [amount, setAmount] = useState("");
  const [tipOrder, { isLoading }] = useTipOrderMutation();
  const tips = order?.tips || [];
  const doneAt = new Date(order?.completedAt || order?.updatedAt || 0).getTime();
  const open = order?.escrow?.status === "released" && Date.now() - doneAt < 30 * 86400000;
  if (!open && !tips.length) return null;
  const price = Number(order?.price || 0);
  const max = price < 25 ? 25 : price;
  const presets = [5, 10, 20].filter((v) => v <= max);

  async function send(value) {
    const res = await tipOrder({ orderId, amount: Number(value) });
    if (res.error) return toast.error(res.error?.data?.message || "Could not send the tip");
    if (res.data?.provider === "stripe") window.location = res.data.url;
    else toast.success("Thanks! Your tip was sent to the seller.");
    setAmount("");
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <IoHeartOutline className="text-rose-500" /> Tip your seller
      </h3>
      {tips.length > 0 && (
        <p className="text-xs text-gray-600 mt-1">
          You tipped ${tips.reduce((n, t) => n + Number(t.amount || 0), 0).toFixed(2)}. Thank you!
        </p>
      )}
      {open && (
        <>
          <p className="text-xs text-gray-500 mt-1">Happy with the work? Tips go to the seller (between $5 and ${max}).</p>
          <div className="flex gap-2 mt-3">
            {presets.map((v) => (
              <button key={v} disabled={isLoading} onClick={() => send(v)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:border-emerald-500">
                ${v}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(amount); }} className="flex gap-2 mt-2">
            <input type="number" min={5} max={max} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <button disabled={isLoading || !amount} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">Tip</button>
          </form>
        </>
      )}
    </section>
  );
}
