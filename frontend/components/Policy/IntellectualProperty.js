"use client";
import PolicyPage, { RELATED } from "./PolicyPage";

export default function IntellectualProperty() {
  return (
    <PolicyPage
      title="Intellectual property"
      updated="24 October 2026"
      intro="Respecting other people's work is part of selling on Qwlee. This page explains who owns delivered work and how to report content that infringes your rights."
      related={RELATED.filter((r) => r.href !== "/intellectual-property")}
      sections={[
        {
          heading: "Who owns delivered work",
          body: ["Once an order is completed and paid, the seller transfers ownership of the delivered work to the buyer, unless the gig description or a custom offer clearly says otherwise (for example a licence for stock items, or the seller keeping the right to show the work in their portfolio). Fonts, stock images, music and other third-party material keep their own licences; sellers must tell buyers about them."],
        },
        {
          heading: "Sellers' responsibilities",
          list: [
            "Only deliver work you created or have the right to use and pass on.",
            "Don't use trademarks, characters or brand assets without permission.",
            "Don't copy another seller's gig text, images or portfolio.",
          ],
        },
        {
          heading: "Reporting infringement",
          body: [
            "If you own rights in material that appears on Qwlee without permission, send a report through our support page (choose 'Intellectual property'). Include your contact details, the work you own, the link to the content on Qwlee, and a statement that the report is accurate and made in good faith.",
            "We review reports, may remove the content, and tell the person who posted it, who can respond with a counter-notice. Knowingly false reports may lead to action against the reporter's account.",
          ],
        },
        {
          heading: "Repeat infringers",
          body: ["Accounts that repeatedly post infringing content are suspended."],
        },
      ]}
    />
  );
}
