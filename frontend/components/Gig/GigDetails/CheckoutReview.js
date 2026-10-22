"use client";
// Order review step shown before payment: the server-priced line items,
// delivery estimate and terms. Nothing is charged until "Confirm and pay".
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoClose, IoShieldCheckmarkOutline, IoTimeOutline } from "react-icons/io5";

export default function CheckoutReview({ open, onClose, onConfirm, quote, loading, confirming, error, gig, packageName }) {
  const [agree, setAgree] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setAgree(false);
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const items = quote?.items || [];
  const due = quote?.deliveryDays ? new Date(Date.now() + quote.deliveryDays * 86400000) : null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="checkout-title" className="text-lg font-semibold text-gray-900">Review your order</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100">
            <IoClose className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            {gig?.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gig.images[0]} alt="" className="w-24 h-16 object-cover rounded-lg bg-gray-100" />
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{gig?.title}</p>
              <p className="text-xs text-gray-500 mt-1">{packageName} package · by {gig?.userId?.fullName || "seller"}</p>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Calculating price…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-rose-600">{error}</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</td>
                      <td className="py-2 text-right font-medium text-gray-900">${(Number(it.price) * (it.quantity || 1)).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 text-gray-700">Service fee</td>
                    <td className="py-2 text-right text-gray-900">$0</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-3 font-semibold text-gray-900">Total</td>
                    <td className="pt-3 text-right text-xl font-bold text-gray-900">${Number(quote?.total || 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              {due ? (
                <p className="flex items-center gap-2 text-sm text-gray-600">
                  <IoTimeOutline /> {quote.deliveryDays}-day delivery · due about {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-xs text-gray-600 bg-emerald-50 rounded-lg p-3">
                <IoShieldCheckmarkOutline className="text-emerald-600 text-base shrink-0" />
                Your payment is held in escrow and only released to the seller when you accept the delivery.
              </p>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-emerald-600" />
                <span>
                  I agree to the <Link href="/terms-of-service" target="_blank" className="text-emerald-700 underline">terms of service</Link>.
                </span>
              </label>
            </>
          )}
        </div>
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!agree || loading || confirming || !!error}
            className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirming ? "Processing…" : `Confirm and pay $${Number(quote?.total || 0).toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
