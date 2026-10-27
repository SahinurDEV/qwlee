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
const BLOCK_TYPES = new Set(["header", "text", "button", "image", "divider", "footer"]);

const known = (key) => {
  if (!email.TEMPLATE_KEYS.includes(key)) throw new ApiError(httpStatus.NOT_FOUND, "Unknown email template");
};
const sample = (key) => SAMPLES[key] || [{}];
const variables = (key) => {
  const s = sample(key);
  const obj = s.find((x) => x && typeof x === "object");
  return [...(obj ? Object.keys(obj) : ["code"]), "subject"];
};
const cleanBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return undefined;
  return blocks
    .filter((b) => b && BLOCK_TYPES.has(b.type))
    .slice(0, 40)
    .map((b, i) => ({
      id: String(b.id || `b${i}`).slice(0, 40),
      type: b.type,
      text: String(b.text || "").slice(0, 4000),
      url: String(b.url || "").slice(0, 500),
      align: ["left", "center", "right"].includes(b.align) ? b.align : "left",
      style: ["light", "brand", "dark"].includes(b.style) ? b.style : "light",
    }));
};
const clean = (body = {}) => {
  const out = { disabled: !!body.disabled };
  for (const f of FIELDS) out[f] = String(body[f] ?? "").slice(0, LIMITS[f]);
  const blocks = cleanBlocks(body.blocks);
  if (blocks) out.blocks = blocks;
  return out;
};

function renderBlocksHtml(blocks, vars = {}) {
  const fill = (s) => String(s || "").replace(/\{\{([\w.]+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parts = (blocks || []).map((b) => {
    const align = b.align || "left";
    if (b.type === "header") return `<div style="padding:24px;text-align:${align};background:#059669;color:#fff;font-size:20px;font-weight:700">${esc(fill(b.text) || "Qwlee")}</div>`;
    if (b.type === "text") return `<div style="padding:16px 24px;text-align:${align};color:#0f172a;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(fill(b.text))}</div>`;
    if (b.type === "button") return `<div style="padding:8px 24px;text-align:${align}"><a href="${esc(fill(b.url) || "#")}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(fill(b.text) || "Open")}</a></div>`;
    if (b.type === "image") return b.url ? `<div style="padding:8px 24px;text-align:${align}"><img src="${esc(fill(b.url))}" alt="" style="max-width:100%;border-radius:8px"/></div>` : "";
    if (b.type === "divider") return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 24px"/>`;
    if (b.type === "footer") return `<div style="padding:20px 24px;text-align:${align};color:#64748b;font-size:12px">${esc(fill(b.text) || "You received this email from Qwlee.")}</div>`;
    return "";
  });
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif"><div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">${parts.join("")}</div></body></html>`;
}

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
  const cleaned = draft ? clean(draft) : undefined;
  let custom = await email.renderTemplate(key, sample(key), cleaned);
  // If the draft includes visual blocks, prefer that HTML for the preview.
  if (cleaned?.blocks?.length) {
    const vars = Object.assign({}, ...(sample(key).filter((x) => x && typeof x === "object")));
    custom = { subject: cleaned.subject || custom.subject, html: renderBlocksHtml(cleaned.blocks, { ...vars, subject: cleaned.subject || custom.subject }) };
  }
  return { builtIn, custom, variables: variables(key) };
}

async function save(key, body, userId) {
  known(key);
  const v = clean(body);
  if (v.disabled && !email.EMAIL_CATEGORY[key]) throw new ApiError(httpStatus.BAD_REQUEST, "Sign-in, password, payout and moderation emails can't be turned off");
  const prev = await EmailTemplate.findOne({ key }).lean();
  const versions = [...(prev?.versions || [])];
  if (prev) {
    versions.unshift({
      at: new Date(),
      by: userId,
      snapshot: {
        subject: prev.subject, heroTitle: prev.heroTitle, intro: prev.intro,
        footerNote: prev.footerNote, ctaLabel: prev.ctaLabel, disabled: prev.disabled, blocks: prev.blocks,
      },
    });
  }
  const doc = await EmailTemplate.findOneAndUpdate(
    { key },
    { $set: { ...v, updatedBy: userId, versions: versions.slice(0, 20) } },
    { upsert: true, new: true }
  );
  email.invalidateTemplates();
  return doc;
}

async function restore(key, index, userId) {
  known(key);
  const doc = await EmailTemplate.findOne({ key });
  if (!doc) throw new ApiError(httpStatus.NOT_FOUND, "No saved version");
  const snap = (doc.versions || [])[Number(index)];
  if (!snap?.snapshot) throw new ApiError(httpStatus.NOT_FOUND, "Version not found");
  Object.assign(doc, clean(snap.snapshot));
  doc.updatedBy = userId;
  await doc.save();
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

module.exports = { list, preview, save, reset, testSend, restore, renderBlocksHtml, SAMPLES };
