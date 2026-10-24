"use client";
import PolicyPage, { RELATED, usePolicy } from "./PolicyPage";

export default function CommunityStandards() {
  const p = usePolicy();
  return (
    <PolicyPage
      title="Community Standards"
      updated="24 October 2026"
      intro="Qwlee works when buyers and sellers can trust each other. These standards explain what we expect from everyone on the platform and what happens when someone falls short. They sit alongside our Terms of Service; if the two ever disagree, the Terms apply."
      related={RELATED.filter((r) => r.href !== "/community-standards")}
      sections={[
        {
          heading: "Be honest about who you are",
          body: ["Use one personal account, with your real name and accurate details. Sellers may be asked to verify their identity before their services appear in search. Do not create accounts for someone else, share your login, or buy, sell or rent accounts."],
        },
        {
          heading: "Keep work and payments on Qwlee",
          body: [
            "All orders and payments for work found on Qwlee must go through Qwlee. This is what lets us hold payment safely, step in when something goes wrong, and count the work toward a seller's level.",
            "Before an order exists, do not share email addresses, phone numbers, messaging-app handles or payment details, and do not ask others to pay or talk elsewhere. Once an order is in progress you may use outside tools when the work needs it (for example a design file or a video call), but keep a written summary in the order chat.",
          ],
          list: [
            "Never ask for or offer payment outside Qwlee.",
            "Never ask for passwords, card numbers or remote access to someone's device.",
            "Report anyone who asks you to move off the platform.",
          ],
        },
        {
          heading: "Communicate with respect",
          body: ["No harassment, threats, hate speech, discrimination or sexual content in messages, gigs, reviews or profiles. Don't send bulk unsolicited messages or advertise other services in someone's inbox. New accounts have limits on how many new conversations they can start each day."],
        },
        {
          heading: "Offer real services, described accurately",
          body: ["Gigs must describe a service you will personally deliver, at the price and within the time shown. Images, samples and claims must be your own work or properly licensed. Don't copy another seller's gig, and don't promise results you can't control (for example guaranteed rankings or followers)."],
        },
        {
          heading: "Services we don't allow",
          list: [
            "Anything illegal where the buyer, seller or Qwlee operates.",
            "Fake reviews, fake engagement, bot traffic, or manipulating any ranking or rating system, on Qwlee or elsewhere.",
            "Academic cheating: doing graded coursework, exams or theses for someone to submit as their own.",
            "Hacking, malware, account takeover, data scraping without permission, or selling personal data.",
            "Counterfeits, pirated software or content, and work that infringes someone's intellectual property.",
            "Adult services, weapons, drugs, gambling services, and financial schemes such as pyramid or get-rich-quick offers.",
            "Impersonating a person, brand or government body.",
          ],
          body: ["Moderators review gigs and may ask for changes or remove a gig that breaks these rules. The reason is shown to the seller."],
        },
        {
          heading: "Reviews must be genuine",
          body: [`Only buyers who completed an order can leave a public review, within ${p.reviewWindowDays} days of completion. Offering money, discounts or extras in exchange for a good review, or pressuring someone to change a review, is not allowed. Sellers may post one public reply to each review.`],
        },
        {
          heading: "How we enforce these standards",
          body: [
            `Most first problems get a warning that explains what went wrong. Warnings expire after ${p.warningExpiryDays} days. Repeating the same problem, or collecting several warnings for different problems, can lead to suspension.`,
            "For serious cases we may restrict an account instead: the owner can finish and get paid for orders already in progress and withdraw cleared earnings, but cannot take new work; after the restriction period the account is closed. Fraud, threats and illegal activity can lead to immediate suspension.",
            "If you think we made a mistake you can appeal from your account's notifications or by contacting support.",
          ],
        },
        {
          heading: "Age",
          body: ["You must be at least 18 to use Qwlee."],
        },
      ]}
    />
  );
}
