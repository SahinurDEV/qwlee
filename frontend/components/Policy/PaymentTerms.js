"use client";
import PolicyPage, { RELATED, usePolicy } from "./PolicyPage";

export default function PaymentTerms() {
  const p = usePolicy();
  const m = p.withdrawMin || {};
  return (
    <PolicyPage
      title="Payment terms"
      updated="24 October 2026"
      intro="How money moves on Qwlee: what buyers pay, what sellers earn, and when earnings can be withdrawn. Figures below are the current platform settings and may change; the amount shown at checkout is always the one that applies."
      related={RELATED.filter((r) => r.href !== "/payment-terms")}
      sections={[
        {
          heading: "What buyers pay",
          body: [`Buyers pay the price of the gig package and any extras, plus a service fee of ${p.buyerFeePercent}% of that amount. Orders under $${p.smallOrderUnder} also carry a small order fee of $${Number(p.smallOrderFee).toFixed(2)}. Tips carry the percentage service fee. All fees are shown before you pay.`],
        },
        {
          heading: "Payment protection",
          body: ["Your payment is held by Qwlee, not the seller, until the order completes. If an order is cancelled, see Refunds & cancellations for what is returned."],
        },
        {
          heading: "What sellers earn",
          body: ["Sellers receive the order price minus Qwlee's commission, which is shown in the seller's earnings for each order. The commission also applies to tips and to extras added during an order."],
        },
        {
          heading: "Clearance period",
          body: [`Earnings become available to withdraw ${p.clearanceDays} days after an order completes (${p.clearanceDaysFast} days for Top Rated sellers and Seller Plus Premium members). Until then they show as pending clearance. This gives time to deal with refunds and chargebacks.`],
        },
        {
          heading: "Withdrawals",
          list: [
            `Bank transfer: minimum $${m.bank}.`,
            `PayPal: minimum $${m.paypal}.`,
            `Payoneer: minimum $${m.payoneer}.`,
            `Maximum per request: $${p.withdrawMax}.`,
            `After you add or change payout details, you can withdraw to them after ${p.payoutChangeHoldHours} hours.`,
          ],
          body: ["Your payout provider may charge its own fees or currency conversion."],
        },
        {
          heading: "Chargebacks and negative balances",
          body: ["If a buyer's payment is reversed after the seller was paid, the amount is deducted from the seller's pending or available balance, which may become negative until new earnings cover it. Filing a chargeback for an order you received can lead to account restrictions."],
        },
        {
          heading: "Taxes",
          body: ["You are responsible for any taxes on what you buy or earn. Qwlee may collect tax details where the law requires it."],
        },
      ]}
    />
  );
}
