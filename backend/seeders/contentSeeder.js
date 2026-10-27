const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Privacy = mongoose.model("Privacy");
const Terms = mongoose.model("Terms");
const TrustSafety = mongoose.model("TrustSafety");

const LEGAL_DIR = path.join(__dirname, "../data/legal");
const PRIVACY = fs.readFileSync(path.join(LEGAL_DIR, "privacy.html"), "utf8");
const TERMS = fs.readFileSync(path.join(LEGAL_DIR, "terms.html"), "utf8");

const TRUST = `<h2>Trust &amp; Safety</h2>
<p>Last updated: 27 October 2026</p>
<p>Qwlee's trust &amp; safety program protects buyers and sellers from fraud, harassment, and substandard work.</p>

<h3>How we protect buyers</h3>
<ul>
  <li>Payments held in escrow until delivery is accepted.</li>
  <li>Refund policy for non-delivery and material misrepresentation.</li>
  <li>Verified seller badges for identity-checked freelancers.</li>
  <li>Optional AI tools that help staff review disputes and risk — humans approve money moves.</li>
</ul>

<h3>How we protect sellers</h3>
<ul>
  <li>Buyer verification before high-value orders where enabled.</li>
  <li>Chargeback handling on qualifying transactions.</li>
  <li>Mediation when buyers withhold acceptance after delivery.</li>
</ul>

<h3>Reporting</h3>
<p>To report abusive behaviour, off-platform solicitation, or suspected fraud, use the "Report" control on a gig or message, open a <a href="/support">support</a> ticket, or email <a href="mailto:trust@qwlee.com">trust@qwlee.com</a>.</p>`;

/** Upsert Privacy / Terms / Trust so re-seeds and live updates replace stub content. */
async function upsertLegalContent({ privacy = PRIVACY, terms = TERMS, trustSafety = TRUST } = {}) {
  const privacyDoc = await Privacy.findOneAndUpdate({}, { content: privacy }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const termsDoc = await Terms.findOneAndUpdate({}, { content: terms }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const trustDoc = await TrustSafety.findOneAndUpdate({}, { content: trustSafety }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return { privacy: privacyDoc, terms: termsDoc, trustSafety: trustDoc };
}

async function seedContent() {
  return upsertLegalContent();
}

module.exports = { seedContent, upsertLegalContent, PRIVACY, TERMS, TRUST };
