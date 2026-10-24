"use client";
import PolicyPage, { RELATED, usePolicy } from "./PolicyPage";

export default function RefundPolicy() {
  const p = usePolicy();
  return (
    <PolicyPage
      title="Refunds & cancellations"
      updated="24 October 2026"
      intro="When you buy on Qwlee, your payment is held until the work is accepted. This page explains when an order can be cancelled and how refunds work."
      related={RELATED.filter((r) => r.href !== "/refund-policy")}
      sections={[
        {
          heading: "Before work starts",
          body: ["If an order asks for requirements and you haven't sent them yet, you can cancel it yourself from the order page and receive a full refund, including the service fee."],
        },
        {
          heading: "Mutual cancellation",
          body: ["Either side can ask to cancel an order that is in progress, with a reason. The other side has 48 hours to accept or decline. If they don't answer, the cancellation goes through automatically. Only one request can be open on an order at a time."],
        },
        {
          heading: "Late orders",
          body: [
            "An order becomes late when the delivery date passes without a delivery. If it is still not delivered 24 hours later, the buyer can cancel it straight away, without the seller's agreement.",
            "If nothing is delivered within 30 days of the order, it is cancelled and refunded automatically. Sellers who need more time should ask for an extension before the deadline; the buyer can accept or decline it.",
          ],
        },
        {
          heading: "After delivery",
          body: [`When the seller delivers, the buyer can accept, ask for a revision (within the revisions included), or ask for more time to review. If the buyer does nothing for ${p.autoCompleteDays} days, the order completes automatically. Completed orders can't be cancelled from the order page; contact support if something is seriously wrong, for example if the delivery is not what was ordered.`],
        },
        {
          heading: "Disputes",
          body: ["If you and the other side can't agree, open a dispute from the order page. Our team reviews the order chat, the gig description and the delivery, and decides whether to complete, partly refund or cancel the order. Keeping all communication on Qwlee helps us decide fairly."],
        },
        {
          heading: "How refunds are paid",
          body: [
            "A cancelled order is refunded to the original payment method; for card payments this usually takes 5–10 business days to appear. The service fee is refunded when the whole order is cancelled. If part of an order (a milestone) was already released to the seller, only the unreleased part is refunded.",
            "Tips can be refunded only by our support team, in cases of error or fraud.",
          ],
        },
        {
          heading: "Effect on sellers",
          body: ["Cancellations count against a seller's completion rate and may affect their level, unless our team decides the seller was not at fault. Refunds after completion are taken from the seller's pending or available balance."],
        },
      ]}
    />
  );
}
