const mongoose = require("mongoose");
const HelpArticle = mongoose.model("HelpArticle");

const A = [
  ["Getting started", "all", "What is Qwlee?", "Qwlee is a marketplace where buyers hire freelancers for fixed-price services (gigs) or custom requests.\n\nPayments are held in escrow until the buyer accepts the delivery."],
  ["Getting started", "all", "How do I create an account?", "Click Join, enter your name, email and a password, then confirm the code we email you.\n\nYou can also continue with Google when the site has it switched on."],
  ["Orders", "buyer", "How does escrow protect me?", "When you order, your payment is held by Qwlee, not the seller.\n\n- The seller is paid only after you accept the delivery.\n- If you don't respond, the order completes automatically a few days after delivery.\n- If something goes wrong you can ask for a revision, request a cancellation or open a dispute."],
  ["Orders", "buyer", "How do I cancel an order?", "Open the order and choose Request cancellation. The seller has 48 hours to accept or decline; if they don't answer, the order is cancelled and you are refunded.\n\nIf the order is late you can cancel it straight away."],
  ["Orders", "all", "What happens if an order is late?", "An order becomes late when the delivery date passes. The buyer can then cancel for a full refund, or keep waiting."],
  ["Payments", "buyer", "How do coupons work?", "Enter a coupon code at checkout. The discount comes off what you pay; the seller is still paid the full price."],
  ["Payments", "seller", "When can I withdraw my earnings?", "Earnings become available when an order completes. Go to Earnings and choose Withdraw.\n\nLarge withdrawals may need a second admin approval."],
  ["Selling", "seller", "How do I create a great gig?", "Use a clear title that starts with \"I will\", add 3 strong images, describe what each package includes and answer the common questions in the FAQ.\n\n- Respond to messages quickly\n- Deliver on time\n- Ask happy buyers for a review"],
  ["Selling", "seller", "How do seller levels work?", "Levels are based on your rating, number of reviews and identity verification. Higher levels appear in search filters."],
  ["Account & security", "all", "How do I turn on two-factor sign-in?", "Go to Profile, Edit, Two-factor sign-in and choose Set up. Scan the QR code with an authenticator app and enter the code it shows.\n\nSave your recovery codes somewhere safe."],
  ["Account & security", "all", "How do I sign out of other devices?", "Go to Profile, Edit, Where you're signed in. You can sign out any single device, or all other devices at once."],
];

async function seedHelp() {
  const docs = A.map(([category, audience, title, body], i) => ({
    category, audience, title, body, order: i,
    slug: title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"),
  }));
  const help = await HelpArticle.insertMany(docs);
  return { help };
}

module.exports = { seedHelp };
