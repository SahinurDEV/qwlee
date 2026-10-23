// Admin → Email templates: list, preview, edit, reset and test-send the
// transactional emails (overrides are applied in email.service).
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const EmailTemplate = require("../models/emailTemplate.model");
const email = require("./email.service");

const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString();
const ID = "6a00000000000000000000ab";
const SAMPLES = {
  sendEmailVerification: ["482913"],
  sendResetPasswordEmail: ["482913"],
  sendVerificationEmail: ["sample-token"],
  sendOrderConfirmedBuyer: [{ buyerName: "Alex", sellerName: "Sam Rivera", gigTitle: "Modern logo design", orderId: ID, price: 120, deliveryDate: inDays(3) }],
  sendOrderConfirmedSeller: [{ sellerName: "Sam", buyerName: "Alex Kim", gigTitle: "Modern logo design", orderId: ID, price: 120, deliveryDate: inDays(3) }],
  sendOrderDeliveredBuyer: [{ buyerName: "Alex", sellerName: "Sam Rivera", gigTitle: "Modern logo design", orderId: ID, message: "Here are the final files." }],
  sendDeliveryAcceptedSeller: [{ sellerName: "Sam", buyerName: "Alex Kim", gigTitle: "Modern logo design", orderId: ID, price: 120 }],
  sendOrderCancelled: [{ recipientName: "Alex", gigTitle: "Modern logo design", orderId: ID, reason: "Buyer and seller agreed to cancel" }],
  sendExtensionRequestedBuyer: [{ buyerName: "Alex", sellerName: "Sam Rivera", gigTitle: "Modern logo design", orderId: ID, newDeliveryDate: inDays(5), reason: "Extra revision" }],
  sendExtensionResponseSeller: [{ sellerName: "Sam", buyerName: "Alex Kim", gigTitle: "Modern logo design", orderId: ID, accepted: true, newDeliveryDate: inDays(5) }],
  sendReviewReceivedSeller: [{ sellerName: "Sam", buyerName: "Alex Kim", gigTitle: "Modern logo design", rating: 5, review: "Great work, fast delivery." }],
  sendReviewReplyBuyer: [{ buyerName: "Alex", sellerName: "Sam Rivera", gigTitle: "Modern logo design", reply: "Thanks Alex!" }],
  sendCustomOfferReceivedBuyer: [{ buyerName: "Alex", sellerName: "Sam Rivera", title: "Logo + brand kit", price: 250, deliveryDays: 5 }],
  sendNewMessageEmail: [{ recipientName: "Alex", senderName: "Sam Rivera", preview: "Hi! Quick question about the colours…", chatUrl: "/inbox" }],
  sendWithdrawalRequested: [{ recipientName: "Sam", amount: 300, bankName: "City Bank", accountNumber: "****1234" }],
  sendWithdrawalApproved: [{ recipientName: "Sam", amount: 300, bankName: "City Bank" }],
  sendWithdrawalDeclined: [{ recipientName: "Sam", amount: 300, reason: "Bank details didn't match" }],
  sendAccountBanned: [{ recipientName: "Alex", reason: "Repeated spam" }],
  sendAnnouncement: [{ recipientName: "Alex", title: "New feature", message: "You can now pay in milestones.", link: "/help" }],
  sendVerificationApproved: [{ recipientName: "Sam" }],
  sendGigStatusChanged: [{ recipientName: "Sam", gigTitle: "I will design your logo", status: "requires-modification", reason: "Please add a clearer cover image" }],
  sendVerificationRejected: [{ recipientName: "Sam", reason: "The document photo was blurry" }],
};
const FIELDS = ["subject", "heroTitle", "intro", "footerNote", "ctaLabel"];
const LIMITS = { subject: 200, heroTitle: 200, intro: 2000, footerNote: 1000, ctaLabel: 60 };

const known = (key) => {
  if (!email.TEMPLATE_KEYS.includes(key)) throw new ApiError(httpStatus.NOT_FOUND, "Unknown email template");
};
const sample = (key) => SAMPLES[key] || [{}];
const variables = (key) => {
  const s = sample(key);
  const obj = s.find((x) => x && typeof x === "object");
  return [...(obj ? Object.keys(obj) : ["code"]), "subject"];
};
const clean = (body = {}) => {
  const out = { disabled: !!body.disabled };
  for (const f of FIELDS) out[f] = String(body[f] ?? "").slice(0, LIMITS[f]);
  return out;
};

async function list() {
  const docs = new Map((await EmailTemplate.find().lean()).map((d) => [d.key, d]));
  return email.TEMPLATE_KEYS.map((key) => ({
    key,
    category: email.EMAIL_CATEGORY[key] || "always",
    canDisable: !!email.EMAIL_CATEGORY[key],
    variables: variables(key),
    override: docs.get(key) || null,
  }));
}

async function preview(key, draft) {
  known(key);
  const builtIn = await email.renderTemplate(key, sample(key), null);
  const custom = await email.renderTemplate(key, sample(key), draft ? clean(draft) : undefined);
  return { builtIn, custom, variables: variables(key) };
}

async function save(key, body, userId) {
  known(key);
  const v = clean(body);
  if (v.disabled && !email.EMAIL_CATEGORY[key]) throw new ApiError(httpStatus.BAD_REQUEST, "Sign-in, password, payout and moderation emails can't be turned off");
  const doc = await EmailTemplate.findOneAndUpdate({ key }, { $set: { ...v, updatedBy: userId } }, { upsert: true, new: true });
  email.invalidateTemplates();
  return doc;
}

async function reset(key) {
  known(key);
  await EmailTemplate.deleteOne({ key });
  email.invalidateTemplates();
  return { reset: true };
}

// Sends the saved version with sample data to the signed-in admin.
async function testSend(key, to) {
  known(key);
  email.invalidateTemplates();
  const r = await email.renderTemplate(key, sample(key));
  const ok = await email.sendEmail(to, `[Test] ${r.subject}`, r.html);
  return { sent: ok, to };
}

module.exports = { list, preview, save, reset, testSend, SAMPLES };
