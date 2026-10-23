// Transactional email — Qwlee.
//
// Two responsibilities:
//   1. Hold the SMTP transport. Credentials read lazily from AppConfig
//      (admin-managed) with .env as a fallback. Cached and rebuilt only
//      when the credentials signature changes — admin can update SMTP
//      from /dashboard/setting and the next outbound email picks it up
//      with no server restart.
//   2. Provide a single Fiverr-style template shell + a fleet of named
//      `send*` helpers, one per platform event. The shell is the only
//      thing that knows what an email looks like; the helpers describe
//      content. Add a new event = one new helper, not a new template.

const nodemailer = require("nodemailer");
const config = require("../config/config");
const logger = require("../config/logger");

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------
let cachedTransport = null;
let cachedSignature = "";
let cachedFrom = config.email?.from || "";

async function readSmtp() {
  try {
    const { appConfigService } = require("./");
    const cfg = await appConfigService.getConfig();
    const s = cfg?.smtp || {};
    if (s.host) {
      return {
        smtp: {
          host: s.host,
          port: s.port || 587,
          secure: !!s.secure,
          auth: s.user || s.pass ? { user: s.user, pass: s.pass } : undefined,
        },
        from:
          s.fromEmail && s.fromName
            ? `"${s.fromName}" <${s.fromEmail}>`
            : s.fromEmail || config.email?.from || "noreply@qwlee.com",
      };
    }
  } catch (e) {
    /* fall through */
  }
  return { smtp: config.email.smtp, from: config.email.from };
}

async function getTransport() {
  const { smtp, from } = await readSmtp();
  const sig = JSON.stringify(smtp);
  if (cachedTransport && sig === cachedSignature) {
    return { transport: cachedTransport, from: cachedFrom };
  }
  cachedTransport = nodemailer.createTransport(smtp);
  cachedSignature = sig;
  cachedFrom = from;
  cachedTransport
    .verify()
    .then(() => logger.info(`SMTP ready (${smtp.host}:${smtp.port})`))
    .catch((err) => logger.warn(`SMTP verify failed: ${err.message}`));
  return { transport: cachedTransport, from };
}

// Returns true when the message was handed to the SMTP server. Callers
// that must tell the user an email was sent (OTP, password reset)
// check the result instead of assuming success. Never throws.
async function sendEmail(to, subject, html) {
  try {
    const ctx = templateCtx.getStore();
    if (ctx?.override?.subject) subject = fill(ctx.override.subject, { ...ctx.vars, subject }, false);
    if (ctx?.capture) {
      ({ subject, html } = await applyBranding(subject, html));
      ctx.captured = { to, subject, html };
      return true;
    }
    if (!to) return false;
    const { smtp } = await readSmtp();
    if (!smtp?.host) {
      logger.warn(`Email to ${to} skipped: SMTP is not configured`);
      return false;
    }
    ({ subject, html } = await applyBranding(subject, html));
    const { transport, from } = await getTransport();
    await transport.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    logger.warn(`Email to ${to} failed: ${err.message}`);
    return false;
  }
}

// Admin branding (Settings > Branding / Email): site name, logo and an
// optional footer line are applied to every outgoing email.
async function applyBranding(subject, html) {
  try {
    const site = await require("./siteSettings.service").get();
    const name = site.branding.siteName;
    if (name && name !== "Qwlee") {
      subject = subject.replace(/Qwlee/g, name);
      html = html.replace(/Qwlee/g, escapeHtml(name));
    }
    if (site.branding.logoUrl && /^https?:\/\//.test(site.branding.logoUrl)) html = html.split(LOGO_URL).join(escapeHtml(site.branding.logoUrl));
    if (site.email.footerText) {
      const note = `<p style="margin:16px auto 0;max-width:560px;font-size:12px;color:#94a3b8;text-align:center;font-family:Arial,sans-serif;">${escapeHtml(site.email.footerText)}</p>`;
      html = html.includes("</body>") ? html.replace("</body>", `${note}</body>`) : html + note;
    }
  } catch (e) {
    logger.warn(`email branding skipped: ${e.message}`);
  }
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Admin template overrides (Admin → Email templates)
// ---------------------------------------------------------------------------
// Each named email runs inside templateCtx, so sendEmail and emailShell
// know which template is being sent and can apply the admin's overrides:
// subject, heading, intro, footer note and button label, with {{variables}}
// taken from the email's own data. Values are HTML-escaped; layout, order
// summary tables and links stay built-in.
const { AsyncLocalStorage } = require("async_hooks");
const templateCtx = new AsyncLocalStorage();
let tplCache = { at: 0, map: new Map() };
async function overrides() {
  if (Date.now() - tplCache.at < 30000) return tplCache.map;
  try {
    const docs = await require("../models/emailTemplate.model").find().lean();
    tplCache = { at: Date.now(), map: new Map(docs.map((d) => [d.key, d])) };
  } catch {
    tplCache = { at: Date.now(), map: new Map() };
  }
  return tplCache.map;
}
const invalidateTemplates = () => { tplCache.at = 0; };
// html=true: the admin's text is escaped too (no raw HTML in overrides).
function fill(tpl, vars, html = true) {
  return (html ? escapeHtml(String(tpl)) : String(tpl)).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
    const v = vars?.[k];
    if (v === undefined || v === null || typeof v === "object") return "";
    return html ? escapeHtml(String(v)) : String(v);
  });
}
function templateVars(args) {
  const data = args.find((a) => a && typeof a === "object" && !Array.isArray(a)) || {};
  const out = {};
  for (const [k, v] of Object.entries(data)) if (["string", "number", "boolean"].includes(typeof v)) out[k] = v;
  if (["string", "number"].includes(typeof args[0]) && !Object.keys(data).length) out.code = String(args[0]);
  return out;
}
// Wrap a template function so overrides apply (and disabled optional
// templates are skipped).
function withTemplate(key, fn) {
  return async (to, ...args) => {
    const override = (await overrides()).get(key) || null;
    if (override?.disabled && EMAIL_CATEGORY[key]) {
      logger.info(`Email ${key} to ${to} skipped: template turned off by an admin`);
      return false;
    }
    const ctx = { key, override, vars: templateVars(args) };
    return templateCtx.run(ctx, () => fn(to, ...args));
  };
}
// Render without sending (admin preview). override: null = built-in text.
async function renderTemplate(key, sample, override) {
  const fn = RAW[key];
  if (!fn) return null;
  const ctx = { key, override: override === undefined ? (await overrides()).get(key) || null : override, vars: templateVars(sample), capture: true };
  await templateCtx.run(ctx, () => fn("preview@example.com", ...sample));
  return ctx.captured || null;
}

// ---------------------------------------------------------------------------
// Template shell
// ---------------------------------------------------------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8000";
const LOGO_URL = "https://i.ibb.co/99DDJ34/Property-1-Logo-Mark-1.png";

const ACCENTS = {
  emerald: { from: "#059669", to: "#0d9488", pillBg: "#f0fdf4", pillBorder: "#bbf7d0", pillText: "#047857" },
  sky:     { from: "#0284c7", to: "#0891b2", pillBg: "#f0f9ff", pillBorder: "#bae6fd", pillText: "#0369a1" },
  amber:   { from: "#d97706", to: "#ea580c", pillBg: "#fffbeb", pillBorder: "#fde68a", pillText: "#b45309" },
  rose:    { from: "#e11d48", to: "#be123c", pillBg: "#fff1f2", pillBorder: "#fecdd3", pillText: "#be123c" },
  violet:  { from: "#7c3aed", to: "#6d28d9", pillBg: "#f5f3ff", pillBorder: "#ddd6fe", pillText: "#6d28d9" },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// One template — every email is just `emailShell(...)` with content
// chunks. Inline CSS only (Gmail/Outlook strip <style> blocks).
function emailShell({
  preheader = "",
  heroEyebrow,
  heroTitle,
  intro,
  bodyHtml = "",
  cta,
  secondaryCta,
  footerNote,
  accent = "emerald",
}) {
  const ctx = templateCtx.getStore();
  const o = ctx?.override;
  if (o) {
    // heroTitle is escaped below; intro/footerNote are HTML slots.
    if (o.heroTitle) heroTitle = fill(o.heroTitle, ctx.vars, false);
    if (o.intro) intro = fill(o.intro, ctx.vars).replace(/\n/g, "<br/>");
    if (o.footerNote) footerNote = fill(o.footerNote, ctx.vars).replace(/\n/g, "<br/>");
    if (o.ctaLabel && cta) cta = { ...cta, label: fill(o.ctaLabel, ctx.vars, false) };
  }
  const tone = ACCENTS[accent] || ACCENTS.emerald;
  const btn = (c) =>
    c
      ? `<a href="${c.url}" style="display:inline-block;background:${
          c.primary === false ? "#ffffff" : tone.from
        };color:${c.primary === false ? tone.from : "#ffffff"};text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;border:1px solid ${
          c.primary === false ? "#e2e8f0" : "transparent"
        };margin-right:10px;">${escapeHtml(c.label)}</a>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(heroTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</span>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 28px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,${tone.from} 0%, ${tone.to} 100%);padding:26px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td><img src="${LOGO_URL}" alt="Qwlee" width="110" style="display:block;max-width:110px;border:0;outline:none;text-decoration:none;" /></td>
                <td align="right" style="color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;opacity:0.9;">${
                  heroEyebrow ? escapeHtml(heroEyebrow) : ""
                }</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px 8px;">
              <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(heroTitle)}</h1>
              ${intro ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#475569;">${intro}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 0;">${bodyHtml}</td>
          </tr>
          ${
            cta || secondaryCta
              ? `<tr><td style="padding:22px 36px 4px;">${btn(cta)}${btn(secondaryCta)}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:26px 36px 0;border-top:1px solid #f1f5f9;">
              ${footerNote ? `<p style="margin:14px 0 0;font-size:13px;color:#64748b;line-height:1.6;">${footerNote}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 28px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You received this email because of activity on your Qwlee account. If this wasn&rsquo;t you, ignore this message or
                <a href="${FRONTEND_URL}/support" style="color:${tone.from};text-decoration:none;">contact support</a>.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">
                <strong style="color:#475569;">Qwlee</strong> &middot; The freelance marketplace &middot;
                <a href="${FRONTEND_URL}" style="color:${tone.from};text-decoration:none;">qwlee.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- shared content fragments ---------------------------------------------
function otpBlock(otp, accent = "emerald") {
  const tone = ACCENTS[accent] || ACCENTS.emerald;
  return `<div style="margin:8px 0;padding:18px 22px;background:${tone.pillBg};border:1px solid ${tone.pillBorder};border-radius:12px;text-align:center;">
    <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:${tone.pillText};text-transform:uppercase;">Your verification code</div>
    <div style="margin-top:8px;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#0f172a;">${escapeHtml(otp)}</div>
    <div style="margin-top:8px;font-size:12px;color:#64748b;">This code expires in 3 minutes.</div>
  </div>`;
}

function summaryTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 4px;border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
    ${rows
      .map(
        (r, i) => `<tr>
        <td style="padding:12px 18px;font-size:13px;color:#64748b;border-bottom:${
          i === rows.length - 1 ? "0" : "1px solid #e2e8f0"
        };width:38%;">${escapeHtml(r.label)}</td>
        <td style="padding:12px 18px;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-bottom:${
          i === rows.length - 1 ? "0" : "1px solid #e2e8f0"
        };">${r.html || escapeHtml(r.value ?? "—")}</td>
      </tr>`
      )
      .join("")}
  </table>`;
}

function quoteBlock(text) {
  return `<blockquote style="margin:8px 0 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 8px 8px 0;color:#475569;font-size:14px;line-height:1.65;font-style:italic;">
    ${escapeHtml(text)}
  </blockquote>`;
}

function fmtMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function shortId(id) {
  return String(id || "")
    .slice(-8)
    .toUpperCase();
}

// ===========================================================================
// AUTH
// ===========================================================================
async function sendEmailVerification(to, otp) {
  return sendEmail(
    to,
    "Welcome to Qwlee — verify your email",
    emailShell({
      preheader: `Your Qwlee verification code is ${otp}.`,
      heroEyebrow: "Welcome",
      heroTitle: "Verify your email to get started",
      intro:
        "Thanks for joining Qwlee. Enter the 6-digit code below on the verification screen to activate your account.",
      bodyHtml: otpBlock(otp, "emerald"),
      footerNote:
        "Didn&rsquo;t create a Qwlee account? You can safely ignore this email.",
    })
  );
}

async function sendResetPasswordEmail(to, otp) {
  return sendEmail(
    to,
    "Reset your Qwlee password",
    emailShell({
      preheader: `Your password-reset code is ${otp}.`,
      heroEyebrow: "Account",
      heroTitle: "Reset your password",
      intro:
        "Use the code below on the password-reset screen to choose a new password.",
      bodyHtml: otpBlock(otp, "sky"),
      footerNote:
        "If you didn&rsquo;t ask to reset your password, ignore this email — your password won&rsquo;t change.",
      accent: "sky",
    })
  );
}

async function sendVerificationEmail(to, token) {
  const url = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail(
    to,
    "Confirm your email on Qwlee",
    emailShell({
      preheader: "Confirm your email to activate your Qwlee account.",
      heroEyebrow: "Account",
      heroTitle: "Confirm your email",
      intro:
        "Tap the button below to confirm this email address on your Qwlee account.",
      bodyHtml: `<p style="margin:0;font-size:13px;color:#64748b;">If the button doesn&rsquo;t work, paste this link into your browser:</p>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;word-break:break-all;">${url}</p>`,
      cta: { label: "Confirm email", url },
    })
  );
}

// ===========================================================================
// ORDERS
// ===========================================================================
async function sendOrderConfirmedBuyer(to, { buyerName, sellerName, gigTitle, orderId, price, deliveryDate }) {
  await sendEmail(
    to,
    `Order placed — ${gigTitle}`,
    emailShell({
      preheader: `Your order with ${sellerName} is now active.`,
      heroEyebrow: "Order placed",
      heroTitle: `Hi ${buyerName || "there"} — your order is active 🎉`,
      intro: `${sellerName} has been notified and will get started right away. Track progress and chat with the seller in your order page.`,
      bodyHtml: summaryTable([
        { label: "Order #", value: shortId(orderId) },
        { label: "Service", value: gigTitle },
        { label: "Seller", value: sellerName },
        { label: "Total paid", value: fmtMoney(price) },
        { label: "Estimated delivery", value: fmtDate(deliveryDate) },
      ]),
      cta: { label: "Open order page", url: `${FRONTEND_URL}/order/${orderId}` },
      footerNote: "Funds are held in escrow and only released when you accept the delivery.",
    })
  );
}

async function sendOrderConfirmedSeller(to, { sellerName, buyerName, gigTitle, orderId, price, deliveryDate }) {
  await sendEmail(
    to,
    `🎉 New order — ${gigTitle}`,
    emailShell({
      preheader: `${buyerName} just placed an order on your gig.`,
      heroEyebrow: "New order",
      heroTitle: `Congratulations ${sellerName || "there"} — you have a new order!`,
      intro: `${buyerName} just placed an order on your gig. Get started so you deliver on time.`,
      bodyHtml: summaryTable([
        { label: "Order #", value: shortId(orderId) },
        { label: "Service", value: gigTitle },
        { label: "Buyer", value: buyerName },
        { label: "Order value", value: fmtMoney(price) },
        { label: "Deliver by", value: fmtDate(deliveryDate) },
      ]),
      cta: { label: "Open order page", url: `${FRONTEND_URL}/order/${orderId}` },
      footerNote: "Need more time? Request an extension before the deadline.",
    })
  );
}

async function sendOrderDeliveredBuyer(to, { buyerName, sellerName, gigTitle, orderId, message }) {
  await sendEmail(
    to,
    `Delivery from ${sellerName} — review & accept`,
    emailShell({
      preheader: `${sellerName} delivered your order. Review and accept when ready.`,
      heroEyebrow: "Delivery",
      heroTitle: `${sellerName} has delivered your order`,
      intro: `Hi ${buyerName || "there"} — ${sellerName} delivered the work for "${gigTitle}". Review the delivery, then accept or request a revision.`,
      bodyHtml:
        summaryTable([
          { label: "Order #", value: shortId(orderId) },
          { label: "Service", value: gigTitle },
          { label: "Seller", value: sellerName },
        ]) +
        (message
          ? `<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Seller&rsquo;s message:</p>` + quoteBlock(message)
          : ""),
      cta: { label: "Review delivery", url: `${FRONTEND_URL}/order/${orderId}` },
    })
  );
}

async function sendDeliveryAcceptedSeller(to, { sellerName, buyerName, gigTitle, orderId, price }) {
  await sendEmail(
    to,
    `✅ Delivery accepted — ${gigTitle}`,
    emailShell({
      preheader: `${buyerName} accepted your delivery.`,
      heroEyebrow: "Order completed",
      heroTitle: `${buyerName} accepted your delivery 🎉`,
      intro: `Great work, ${sellerName || "there"}. The order has been completed and ${fmtMoney(
        price
      )} (minus platform commission) has been credited to your balance.`,
      bodyHtml: summaryTable([
        { label: "Order #", value: shortId(orderId) },
        { label: "Service", value: gigTitle },
        { label: "Buyer", value: buyerName },
        { label: "Order value", value: fmtMoney(price) },
      ]),
      cta: { label: "View earnings", url: `${FRONTEND_URL}/earnings` },
      footerNote: "A glowing review never hurts — kindly remind the buyer to leave one if they liked the work.",
    })
  );
}

async function sendOrderCancelled(to, { recipientName, gigTitle, orderId, reason }) {
  await sendEmail(
    to,
    `Order cancelled — ${gigTitle}`,
    emailShell({
      preheader: "An order on your Qwlee account was cancelled.",
      heroEyebrow: "Order cancelled",
      heroTitle: `Order on "${gigTitle}" was cancelled`,
      intro: `Hi ${recipientName || "there"} — this order has been cancelled and is no longer active.`,
      bodyHtml:
        summaryTable([
          { label: "Order #", value: shortId(orderId) },
          { label: "Service", value: gigTitle },
        ]) +
        (reason ? `<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Reason:</p>` + quoteBlock(reason) : ""),
      cta: { label: "View order", url: `${FRONTEND_URL}/order/${orderId}` },
      accent: "rose",
    })
  );
}

// ===========================================================================
// DELIVERY EXTENSION
// ===========================================================================
async function sendExtensionRequestedBuyer(to, { buyerName, sellerName, gigTitle, orderId, newDeliveryDate, reason }) {
  await sendEmail(
    to,
    `${sellerName} requested a delivery extension`,
    emailShell({
      preheader: `${sellerName} asked to extend the delivery date.`,
      heroEyebrow: "Extension request",
      heroTitle: `${sellerName} requested a delivery extension`,
      intro: `Hi ${buyerName || "there"} — ${sellerName} would like to extend the delivery date for "${gigTitle}". Accept or decline from the order page.`,
      bodyHtml:
        summaryTable([
          { label: "Order #", value: shortId(orderId) },
          { label: "New delivery date", value: fmtDate(newDeliveryDate) },
        ]) + (reason ? `<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Seller&rsquo;s reason:</p>` + quoteBlock(reason) : ""),
      cta: { label: "Review request", url: `${FRONTEND_URL}/order/${orderId}` },
      accent: "amber",
    })
  );
}

async function sendExtensionResponseSeller(to, { sellerName, buyerName, gigTitle, orderId, accepted, newDeliveryDate }) {
  const label = accepted ? "accepted" : "declined";
  await sendEmail(
    to,
    `Buyer ${label} your extension request`,
    emailShell({
      preheader: `${buyerName} ${label} your extension request.`,
      heroEyebrow: "Extension " + (accepted ? "accepted" : "declined"),
      heroTitle: `${buyerName} ${label} your extension request`,
      intro: accepted
        ? `Hi ${sellerName || "there"} — ${buyerName} agreed to the new delivery date. Make sure to deliver before then.`
        : `Hi ${sellerName || "there"} — ${buyerName} declined your extension. The original delivery date still applies.`,
      bodyHtml: summaryTable(
        [
          { label: "Order #", value: shortId(orderId) },
          { label: "Service", value: gigTitle },
          accepted ? { label: "New delivery date", value: fmtDate(newDeliveryDate) } : null,
        ].filter(Boolean)
      ),
      cta: { label: "Open order", url: `${FRONTEND_URL}/order/${orderId}` },
      accent: accepted ? "emerald" : "rose",
    })
  );
}

// ===========================================================================
// REVIEWS
// ===========================================================================
async function sendReviewReceivedSeller(to, { sellerName, buyerName, gigTitle, rating, review }) {
  const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  await sendEmail(
    to,
    `New ⭐ review on "${gigTitle}"`,
    emailShell({
      preheader: `${buyerName} left a ${rating}-star review.`,
      heroEyebrow: "Review",
      heroTitle: `${buyerName} left you a review`,
      intro: `Hi ${sellerName || "there"} — ${buyerName} reviewed your work on "${gigTitle}". You can reply once from the gig page.`,
      bodyHtml:
        summaryTable([
          {
            label: "Rating",
            html: `<span style="color:#f59e0b;font-size:18px;">${stars}</span> <span style="color:#64748b;font-size:12px;">${Number(rating).toFixed(1)}/5</span>`,
          },
          { label: "Reviewer", value: buyerName },
          { label: "Service", value: gigTitle },
        ]) + (review ? `<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Review:</p>` + quoteBlock(review) : ""),
      cta: { label: "Reply to review", url: `${FRONTEND_URL}/gig` },
      accent: "amber",
    })
  );
}

async function sendReviewReplyBuyer(to, { buyerName, sellerName, gigTitle, reply }) {
  await sendEmail(
    to,
    `${sellerName} replied to your review`,
    emailShell({
      preheader: `${sellerName} responded to your review.`,
      heroEyebrow: "Review reply",
      heroTitle: `${sellerName} replied to your review`,
      intro: `Hi ${buyerName || "there"} — ${sellerName} responded to your review on "${gigTitle}".`,
      bodyHtml: reply ? quoteBlock(reply) : "",
      cta: { label: "View on Qwlee", url: `${FRONTEND_URL}/gig` },
      accent: "sky",
    })
  );
}

// ===========================================================================
// CUSTOM OFFERS / MESSAGING
// ===========================================================================
async function sendCustomOfferReceivedBuyer(to, { buyerName, sellerName, title, price, deliveryDays }) {
  await sendEmail(
    to,
    `Custom offer from ${sellerName}`,
    emailShell({
      preheader: `${sellerName} sent you a custom offer.`,
      heroEyebrow: "Custom offer",
      heroTitle: `${sellerName} sent you a custom offer`,
      intro: `Hi ${buyerName || "there"} — review the offer and accept or decline from your inbox.`,
      bodyHtml: summaryTable([
        { label: "Title", value: title },
        { label: "Price", value: fmtMoney(price) },
        { label: "Delivery", value: `${deliveryDays || 0} days` },
      ]),
      cta: { label: "Open inbox", url: `${FRONTEND_URL}/inbox` },
    })
  );
}

async function sendNewMessageEmail(to, { recipientName, senderName, preview, chatUrl }) {
  await sendEmail(
    to,
    `New message from ${senderName}`,
    emailShell({
      preheader: preview?.slice(0, 100) || `${senderName} sent you a message.`,
      heroEyebrow: "New message",
      heroTitle: `${senderName} sent you a message`,
      intro: `Hi ${recipientName || "there"} — you have a new message in your Qwlee inbox.`,
      bodyHtml: preview ? quoteBlock(preview) : "",
      cta: { label: "Open inbox", url: chatUrl || `${FRONTEND_URL}/inbox` },
      accent: "sky",
    })
  );
}

// ===========================================================================
// WITHDRAWAL
// ===========================================================================
async function sendWithdrawalRequested(to, { recipientName, amount, bankName, accountNumber }) {
  await sendEmail(
    to,
    `Withdrawal request received — ${fmtMoney(amount)}`,
    emailShell({
      preheader: `Your withdrawal request is being processed.`,
      heroEyebrow: "Withdrawal",
      heroTitle: `We received your withdrawal request`,
      intro: `Hi ${recipientName || "there"} — your request is in the queue and will be reviewed shortly.`,
      bodyHtml: summaryTable([
        { label: "Amount", value: fmtMoney(amount) },
        { label: "Bank", value: bankName },
        { label: "Account", value: accountNumber ? `••••${String(accountNumber).slice(-4)}` : "—" },
        { label: "Status", value: "Pending review" },
      ]),
      cta: { label: "View earnings", url: `${FRONTEND_URL}/earnings` },
    })
  );
}

async function sendWithdrawalApproved(to, { recipientName, amount, bankName }) {
  await sendEmail(
    to,
    `Withdrawal approved — ${fmtMoney(amount)} on the way`,
    emailShell({
      preheader: `Your withdrawal has been approved.`,
      heroEyebrow: "Withdrawal approved",
      heroTitle: `Your withdrawal has been approved 🎉`,
      intro: `Hi ${recipientName || "there"} — funds are on the way to your bank account. Most banks settle within 2–5 business days.`,
      bodyHtml: summaryTable([
        { label: "Amount", value: fmtMoney(amount) },
        { label: "Bank", value: bankName },
        { label: "Status", value: "Approved" },
      ]),
      cta: { label: "View earnings", url: `${FRONTEND_URL}/earnings` },
    })
  );
}

async function sendWithdrawalDeclined(to, { recipientName, amount, reason }) {
  await sendEmail(
    to,
    `Withdrawal declined`,
    emailShell({
      preheader: `Your withdrawal request was declined.`,
      heroEyebrow: "Withdrawal",
      heroTitle: `Your withdrawal request was declined`,
      intro: `Hi ${recipientName || "there"} — unfortunately your withdrawal couldn&rsquo;t be processed. The amount has been returned to your Qwlee balance.`,
      bodyHtml:
        summaryTable([
          { label: "Amount", value: fmtMoney(amount) },
          { label: "Status", value: "Declined" },
        ]) + (reason ? `<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Reason:</p>` + quoteBlock(reason) : ""),
      cta: { label: "Try again", url: `${FRONTEND_URL}/earnings` },
      accent: "rose",
    })
  );
}

// ===========================================================================
// MODERATION / VERIFICATION
// ===========================================================================
async function sendAccountBanned(to, { recipientName, reason }) {
  await sendEmail(
    to,
    `Your Qwlee account has been suspended`,
    emailShell({
      preheader: `Your account has been suspended.`,
      heroEyebrow: "Account",
      heroTitle: `Your account has been suspended`,
      intro: `Hi ${recipientName || "there"} — your Qwlee account has been suspended. You won&rsquo;t be able to sign in until the issue is resolved.`,
      bodyHtml: reason ? `<p style="margin:0;font-size:13px;color:#64748b;">Reason:</p>` + quoteBlock(reason) : "",
      cta: { label: "Contact support", url: `${FRONTEND_URL}/support` },
      accent: "rose",
    })
  );
}

// Admin broadcast. Returns true when handed to SMTP.
async function sendAnnouncement(to, { recipientName, title, message, link }) {
  const url = link ? (link.startsWith("/") ? `${FRONTEND_URL}${link}` : link) : `${FRONTEND_URL}/notifications`;
  return sendEmail(
    to,
    title,
    emailShell({
      preheader: title,
      heroEyebrow: "Announcement",
      heroTitle: escapeHtml(title),
      intro: `Hi ${escapeHtml(recipientName || "there")},`,
      bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;color:#334155;white-space:pre-line;">${escapeHtml(message)}</p>`,
      cta: { label: "Open Qwlee", url },
      accent: "violet",
    })
  );
}

async function sendVerificationApproved(to, { recipientName }) {
  await sendEmail(
    to,
    `Your seller verification was approved ✅`,
    emailShell({
      preheader: `You&rsquo;re now a verified seller.`,
      heroEyebrow: "Verification",
      heroTitle: `You&rsquo;re now a verified seller ✅`,
      intro: `Hi ${recipientName || "there"} — congrats! Your ID verification was approved. The verified tick now shows on your profile and gigs.`,
      cta: { label: "View your profile", url: `${FRONTEND_URL}/dashboard` },
    })
  );
}

async function sendVerificationRejected(to, { recipientName, reason }) {
  await sendEmail(
    to,
    `Verification — additional information needed`,
    emailShell({
      preheader: `Your verification needs another look.`,
      heroEyebrow: "Verification",
      heroTitle: `We need another look at your verification`,
      intro: `Hi ${recipientName || "there"} — we couldn&rsquo;t verify your submission this time. You can resubmit from your dashboard.`,
      bodyHtml: reason ? `<p style="margin:0;font-size:13px;color:#64748b;">Reviewer notes:</p>` + quoteBlock(reason) : "",
      cta: { label: "Resubmit", url: `${FRONTEND_URL}/dashboard` },
      accent: "amber",
    })
  );
}

// Admin changed a gig in bulk (status or featured).
const GIG_STATUS_TEXT = {
  active: "is live again on the marketplace",
  pending: "is waiting for review",
  "requires-modification": "needs changes before it can go live",
  draft: "was moved back to drafts",
  denied: "was not approved",
  paused: "was paused by our team",
};
async function sendGigStatusChanged(to, { recipientName, gigTitle, status, featured, reason, gigUrl }) {
  const what = featured === true ? "is now featured on Qwlee" : featured === false ? "is no longer featured" : GIG_STATUS_TEXT[status] || `is now ${status}`;
  await sendEmail(
    to,
    `Update on your gig: ${gigTitle}`,
    emailShell({
      preheader: `Your gig ${what}.`,
      heroEyebrow: "Your gig",
      heroTitle: `Your gig ${what}`,
      intro: `Hi ${recipientName || "there"} — our team updated &ldquo;${gigTitle}&rdquo;.`,
      bodyHtml: reason ? `<p style="margin:0;font-size:13px;color:#64748b;">Note from the team:</p>` + quoteBlock(reason) : "",
      cta: { label: "View your gigs", url: gigUrl || `${FRONTEND_URL}/dashboard` },
      accent: status === "denied" || status === "requires-modification" ? "amber" : "emerald",
    })
  );
}

module.exports = {
  // Plumbing
  sendEmail,
  // Auth
  sendEmailVerification,
  sendResetPasswordEmail,
  sendAnnouncement,
  sendVerificationEmail,
  // Orders
  sendOrderConfirmedBuyer,
  sendOrderConfirmedSeller,
  sendOrderDeliveredBuyer,
  sendDeliveryAcceptedSeller,
  sendOrderCancelled,
  // Extension
  sendExtensionRequestedBuyer,
  sendExtensionResponseSeller,
  // Reviews
  sendReviewReceivedSeller,
  sendReviewReplyBuyer,
  // Messaging / offers
  sendCustomOfferReceivedBuyer,
  sendNewMessageEmail,
  // Withdrawals
  sendWithdrawalRequested,
  sendWithdrawalApproved,
  sendWithdrawalDeclined,
  // Moderation
  sendAccountBanned,
  sendVerificationApproved,
  sendVerificationRejected,
  sendGigStatusChanged,
};

// Optional emails a user can switch off (Notification settings). Others
// (sign-in, password, money, moderation) always go out.
const EMAIL_CATEGORY = {
  sendOrderConfirmedBuyer: "orders",
  sendOrderConfirmedSeller: "orders",
  sendOrderDeliveredBuyer: "orders",
  sendDeliveryAcceptedSeller: "orders",
  sendOrderCancelled: "orders",
  sendExtensionRequestedBuyer: "orders",
  sendExtensionResponseSeller: "orders",
  sendReviewReceivedSeller: "reviews",
  sendReviewReplyBuyer: "reviews",
  sendCustomOfferReceivedBuyer: "messages",
  sendNewMessageEmail: "messages",
  sendAnnouncement: "marketing",
};
const gated = (name, fn) => async (to, ...args) => {
  const ok = await require("./notificationPrefs.service").allows({ email: to }, "email", EMAIL_CATEGORY[name]).catch(() => true);
  if (!ok) {
    logger.info(`Email ${name} to ${to} skipped: turned off in the user's notification settings`);
    return false;
  }
  return fn(to, ...args);
};
const RAW = {};
for (const name of Object.keys(module.exports)) {
  if (name === "sendEmail") continue;
  RAW[name] = module.exports[name];
  module.exports[name] = withTemplate(name, module.exports[name]);
}
for (const name of Object.keys(EMAIL_CATEGORY)) module.exports[name] = gated(name, module.exports[name]);
module.exports.TEMPLATE_KEYS = Object.keys(RAW);
module.exports.renderTemplate = renderTemplate;
module.exports.invalidateTemplates = invalidateTemplates;
module.exports.EMAIL_CATEGORY = EMAIL_CATEGORY;

