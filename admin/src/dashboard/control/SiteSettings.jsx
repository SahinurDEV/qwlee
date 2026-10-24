// /dashboard/site-settings — marketplace rules, branding, homepage, SEO,
// email branding and feature toggles (super admins).
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { ErrorNote, Field, input, select, Toggle } from "./ui";

const FEATURES = [
  ["signups", "New sign-ups", "Allow new accounts to register (email and Google)."],
  ["googleLogin", "Google sign-in", "Show 'Continue with Google' (also needs GOOGLE_CLIENT_ID/SECRET)."],
  ["buyerRequests", "Buyer requests", "Buyers can post requests and sellers can send offers."],
  ["tips", "Tips", "Buyers can tip sellers after an order completes."],
];

export default function SiteSettings() {
  const { data, error } = useAdminQuery("/admin/settings/site");
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data?.site) setS(data.site); }, [data]);
  const set = (section, patch) => setS((x) => ({ ...x, [section]: { ...x[section], ...patch } }));
  const save = async () => {
    setSaving(true);
    try {
      const r = await adminFetch("/admin/settings/site", { method: "PATCH", body: s });
      setS(r.site);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div>
      <PageHeader title="Site settings" subtitle="Changes apply immediately to the marketplace." actions={s ? <Button loading={saving} onClick={save}>Save all</Button> : null} />
      <ErrorNote error={error} />
      {s ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" data-testid="site-settings">
          <Card title="Marketplace" subtitle="Money and order rules">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Seller commission (%)" hint="Taken from the seller on each completed order and tip (0–50)."><input type="number" min={0} max={50} step="0.5" className={input} value={s.marketplace.feePercent} onChange={(e) => set("marketplace", { feePercent: e.target.value })} /></Field>
              <Field label="Buyer service fee (%)" hint="Added at checkout on every payment, tips included (0–30)."><input type="number" min={0} max={30} step="0.1" className={input} value={s.marketplace.buyerFeePercent ?? 5.5} onChange={(e) => set("marketplace", { buyerFeePercent: e.target.value })} /></Field>
              <Field label="Small order fee ($)" hint="Flat fee added to orders below the threshold."><input type="number" min={0} max={100} step="0.5" className={input} value={s.marketplace.smallOrderFee ?? 3.5} onChange={(e) => set("marketplace", { smallOrderFee: e.target.value })} /></Field>
              <Field label="Small order threshold ($)" hint="Orders under this amount pay the small order fee."><input type="number" min={0} className={input} value={s.marketplace.smallOrderUnder ?? 200} onChange={(e) => set("marketplace", { smallOrderUnder: e.target.value })} /></Field>
              <Field label="Min withdrawal: bank ($)" hint="Smallest bank transfer a seller can request."><input type="number" min={0} className={input} value={s.marketplace.withdrawMinBank ?? 20} onChange={(e) => set("marketplace", { withdrawMinBank: e.target.value })} /></Field>
              <Field label="Min withdrawal: PayPal ($)"><input type="number" min={0} className={input} value={s.marketplace.withdrawMinPaypal ?? 1} onChange={(e) => set("marketplace", { withdrawMinPaypal: e.target.value })} /></Field>
              <Field label="Min withdrawal: Payoneer ($)"><input type="number" min={0} className={input} value={s.marketplace.withdrawMinPayoneer ?? 10} onChange={(e) => set("marketplace", { withdrawMinPayoneer: e.target.value })} /></Field>
              <Field label="Max per withdrawal ($)"><input type="number" min={1} className={input} value={s.marketplace.withdrawMax ?? 10000} onChange={(e) => set("marketplace", { withdrawMax: e.target.value })} /></Field>
              <Field label="Hold after payout change (hours)" hint="Wait before paying out to new payout details. 0 = off."><input type="number" min={0} max={720} className={input} value={s.marketplace.payoutChangeHoldHours ?? 24} onChange={(e) => set("marketplace", { payoutChangeHoldHours: e.target.value })} /></Field>
              <Field label="Clearance (days)" hint="Days before new earnings can be withdrawn. 0 = at once."><input type="number" min={0} max={90} className={input} value={s.marketplace.clearanceDays ?? 14} onChange={(e) => set("marketplace", { clearanceDays: e.target.value })} /></Field>
              <Field label="Clearance for Top Rated / Premium (days)" hint="Shorter wait for Top Rated sellers and Seller Plus Premium."><input type="number" min={0} max={90} className={input} value={s.marketplace.clearanceDaysFast ?? 7} onChange={(e) => set("marketplace", { clearanceDaysFast: e.target.value })} /></Field>
              <Field label="Auto-complete after (days)" hint="A delivery the buyer ignores is accepted automatically (1–30)."><input type="number" min={1} max={30} className={input} value={s.marketplace.autoCompleteDays} onChange={(e) => set("marketplace", { autoCompleteDays: e.target.value })} /></Field>
              <Field label="Review window (days)" hint="How long after completion a buyer can leave a review. 0 = no limit."><input type="number" min={0} max={365} className={input} value={s.marketplace.reviewWindowDays ?? 14} onChange={(e) => set("marketplace", { reviewWindowDays: e.target.value })} /></Field>
              <Field label="Extra review time (days)" hint="Buyer can push auto-complete back once per delivery. 0 = off."><input type="number" min={0} max={30} className={input} value={s.marketplace.reviewExtensionDays ?? 5} onChange={(e) => set("marketplace", { reviewExtensionDays: e.target.value })} /></Field>
              <Field label="Very late after (hours)" hint="Hours past the due date before the buyer can cancel a late order on their own."><input type="number" min={0} max={720} className={input} value={s.marketplace.veryLateHours ?? 24} onChange={(e) => set("marketplace", { veryLateHours: e.target.value })} /></Field>
              <Field label="Late reminder (days late)" hint="Both sides get one reminder email when an order is this many days late."><input type="number" min={1} max={180} className={input} value={s.marketplace.lateReminderDays ?? 15} onChange={(e) => set("marketplace", { lateReminderDays: e.target.value })} /></Field>
              <Field label="Auto-cancel late orders (days)" hint="Undelivered orders are cancelled and refunded this many days after the due date. 0 = off."><input type="number" min={0} max={365} className={input} value={s.marketplace.lateAutoCancelDays ?? 30} onChange={(e) => set("marketplace", { lateAutoCancelDays: e.target.value })} /></Field>
            </div>
            <Toggle label="Demo payments" hint="Checkout completes without charging a card. Turn off in production." checked={s.marketplace.demoPayments} onChange={(v) => set("marketplace", { demoPayments: v })} />
            <Field label="Second approval over ($)" hint="Refunds and payouts of this amount or more need a second admin. 0 = off."><input type="number" min={0} className={input} value={s.marketplace.secondApprovalOver ?? 0} onChange={(e) => set("marketplace", { secondApprovalOver: e.target.value })} /></Field>
            <Toggle label="Require gig approval" hint="New gigs start as 'pending' until a moderator approves them." checked={s.marketplace.requireGigApproval} onChange={(v) => set("marketplace", { requireGigApproval: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[["new", "New seller"], ["level1", "Level 1"], ["level2", "Level 2"], ["topRated", "Top Rated"]].map(([k, l]) => <Field key={k} label={`Max gigs: ${l}`} hint="0 = no limit"><input type="number" min={0} max={500} className={input} value={s.marketplace.gigCaps?.[k] ?? 0} onChange={(e) => set("marketplace", { gigCaps: { ...(s.marketplace.gigCaps || {}), [k]: e.target.value } })} /></Field>)}</div>
          </Card>
          <Card title="Trust & safety" subtitle="Warnings and restrictions">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Warnings expire after (days)"><input type="number" min={1} className={input} value={s.trust?.warningExpiryDays ?? 90} onChange={(e) => set("trust", { warningExpiryDays: e.target.value })} /></Field>
              <Field label="Escalate at N warnings for the same reason" hint="0 = off."><input type="number" min={0} max={20} className={input} value={s.trust?.suspendAfterSameReason ?? 2} onChange={(e) => set("trust", { suspendAfterSameReason: e.target.value })} /></Field>
              <Field label="Escalate at N active warnings in total" hint="0 = off."><input type="number" min={0} max={20} className={input} value={s.trust?.suspendAfterTotal ?? 3} onChange={(e) => set("trust", { suspendAfterTotal: e.target.value })} /></Field>
              <Field label="Escalation" hint="Restrict first (finish work, then suspended) or suspend at once.">
                <select className={input} value={s.trust?.escalateTo ?? "restrict"} onChange={(e) => set("trust", { escalateTo: e.target.value })}>
                  <option value="restrict">Restrict</option>
                  <option value="suspend">Suspend</option>
                </select>
              </Field>
              <Field label="Restriction length (days)" hint="After this the account is suspended."><input type="number" min={1} max={365} className={input} value={s.trust?.restrictionDays ?? 60} onChange={(e) => set("trust", { restrictionDays: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Admin security" subtitle="Applies to every admin account">
            <Toggle label="Require two-factor for admins" hint="Admins without it can only open My security until they turn it on. Turn it on for yourself first." checked={!!s.security?.requireAdmin2fa} onChange={(v) => set("security", { requireAdmin2fa: v })} />
            <Field label="Admin IP allowlist" hint="One IP or IPv4 range (CIDR) per line, e.g. 203.0.113.7 or 10.0.0.0/8. Empty = any network. Must include your current address.">
              <textarea rows={3} className={input + " font-mono"} value={Array.isArray(s.security?.adminIpAllowlist) ? s.security.adminIpAllowlist.join("\n") : s.security?.adminIpAllowlist || ""} onChange={(e) => set("security", { adminIpAllowlist: e.target.value })} />
            </Field>
          </Card>
          <Card title="Feature toggles">
            {FEATURES.map(([k, label, hint]) => <Toggle key={k} label={label} hint={hint} checked={s.features[k]} onChange={(v) => set("features", { [k]: v })} />)}
          </Card>
          <Card title="Branding">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Site name" hint="Used in emails and the browser title."><input className={input} value={s.branding.siteName} onChange={(e) => set("branding", { siteName: e.target.value })} /></Field>
              <Field label="Primary colour"><div className="flex gap-2"><input type="color" className="h-9 w-12 rounded border border-ink-200" value={s.branding.primaryColor} onChange={(e) => set("branding", { primaryColor: e.target.value })} /><input className={input} value={s.branding.primaryColor} onChange={(e) => set("branding", { primaryColor: e.target.value })} /></div></Field>
              <Field label="Logo URL" hint="https:// image used in emails."><input className={input} value={s.branding.logoUrl} onChange={(e) => set("branding", { logoUrl: e.target.value })} /></Field>
              <Field label="Email footer line" hint="Appended to every email (e.g. company address)."><input className={input} value={s.email.footerText} onChange={(e) => set("email", { footerText: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Homepage">
            <div className="space-y-3">
              <Field label="Hero title" hint="Leave empty for the default."><input className={input} value={s.homepage.heroTitle} onChange={(e) => set("homepage", { heroTitle: e.target.value })} /></Field>
              <Field label="Hero subtitle"><input className={input} value={s.homepage.heroSubtitle} onChange={(e) => set("homepage", { heroSubtitle: e.target.value })} /></Field>
              <div className="rounded-xl border border-ink-200 p-3 space-y-2">
                <Toggle label="Announcement bar" hint="A strip at the top of every marketplace page." checked={s.homepage.announcement.enabled} onChange={(v) => set("homepage", { announcement: { ...s.homepage.announcement, enabled: v } })} />
                <Field label="Text"><input className={input} value={s.homepage.announcement.text} onChange={(e) => set("homepage", { announcement: { ...s.homepage.announcement, text: e.target.value } })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Link (optional)"><input className={input} placeholder="/requests" value={s.homepage.announcement.link} onChange={(e) => set("homepage", { announcement: { ...s.homepage.announcement, link: e.target.value } })} /></Field>
                  <Field label="Tone"><select className={select} value={s.homepage.announcement.tone} onChange={(e) => set("homepage", { announcement: { ...s.homepage.announcement, tone: e.target.value } })}><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option></select></Field>
                </div>
              </div>
            </div>
          </Card>
          <Card title="Maintenance mode" subtitle="Shows a maintenance page on the marketplace and pauses the API for everyone except admins. Takes up to a minute to appear.">
            <div className="space-y-3">
              <Toggle label="Maintenance mode on" hint="Admins keep full access through this dashboard." checked={s.maintenance.enabled} onChange={(v) => set("maintenance", { enabled: v })} />
              <Field label="Message"><input aria-label="Maintenance message" className={input} maxLength={300} placeholder="We're upgrading payments and will be back shortly." value={s.maintenance.message} onChange={(e) => set("maintenance", { message: e.target.value })} /></Field>
              <Field label="Expected back (your local time, optional)"><input aria-label="Maintenance until" type="datetime-local" className={input} value={s.maintenance.until ? toLocalInput(s.maintenance.until) : ""} onChange={(e) => set("maintenance", { until: e.target.value ? new Date(e.target.value).toISOString() : "" })} /></Field>
            </div>
          </Card>
          <Card title="Loyalty fees" subtitle="Lower the fee once a seller has earned a set amount from the same client (like Upwork's sliding fee)">
            <div className="space-y-3" data-testid="loyalty-fees">
              <Toggle label="Loyalty fees on" hint="Applies to the client's next orders with that seller. Seller Plus discounts still apply on top." checked={!!s.marketplace.loyaltyFees?.enabled} onChange={(v) => set("marketplace", { loyaltyFees: { ...(s.marketplace.loyaltyFees || { tiers: [] }), enabled: v } })} />
              {(s.marketplace.loyaltyFees?.tiers || []).map((t, i) => {
                const upd = (patch) => {
                  const tiers = [...s.marketplace.loyaltyFees.tiers];
                  tiers[i] = { ...tiers[i], ...patch };
                  set("marketplace", { loyaltyFees: { ...s.marketplace.loyaltyFees, tiers } });
                };
                return (
                  <div key={i} className="flex items-end gap-3">
                    <Field label="After earning more than ($)"><input aria-label={`Loyalty tier ${i + 1} amount`} type="number" min={0} className={input} value={t.over} onChange={(e) => upd({ over: e.target.value })} /></Field>
                    <Field label="Fee (%)"><input aria-label={`Loyalty tier ${i + 1} fee`} type="number" min={0} max={50} step="0.1" className={input} value={t.percent} onChange={(e) => upd({ percent: e.target.value })} /></Field>
                    <button type="button" className="text-sm text-rose-600 pb-2" onClick={() => set("marketplace", { loyaltyFees: { ...s.marketplace.loyaltyFees, tiers: s.marketplace.loyaltyFees.tiers.filter((_, j) => j !== i) } })}>Remove</button>
                  </div>
                );
              })}
              {(s.marketplace.loyaltyFees?.tiers || []).length < 5 && (
                <button type="button" className="text-sm text-emerald-700" onClick={() => set("marketplace", { loyaltyFees: { ...(s.marketplace.loyaltyFees || { enabled: false }), tiers: [...(s.marketplace.loyaltyFees?.tiers || []), { over: 1000, percent: 2 }] } })}>+ Add tier</button>
              )}
            </div>
          </Card>
          <CategoryFees rules={s.marketplace.categoryFees || []} base={s.marketplace.feePercent} onChange={(categoryFees) => set("marketplace", { categoryFees })} />
          <HomepageBuilder home={s.homepage} onChange={(patch) => set("homepage", patch)} />
          <Card title="SEO" subtitle="Default title and description for search engines and link previews">
            <div className="space-y-3">
              <Field label={`Meta title (${s.seo.title.length}/70)`}><input className={input} maxLength={70} value={s.seo.title} onChange={(e) => set("seo", { title: e.target.value })} /></Field>
              <Field label={`Meta description (${s.seo.description.length}/170)`}><textarea rows={3} maxLength={170} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={s.seo.description} onChange={(e) => set("seo", { description: e.target.value })} /></Field>
              <Field label="Share image URL"><input className={input} value={s.seo.ogImage} onChange={(e) => set("seo", { ogImage: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Payment providers & SMTP">
            <p className="text-sm text-ink-600">Provider keys, SMTP and email template previews live on the <a className="text-primary-700 underline" href={`${import.meta.env.BASE_URL}dashboard/setting`}>Settings</a> page.</p>
          </Card>
          {s.growth ? (
            <Card title="Referrals" subtitle="Invitees get a first-order discount; inviters get a coupon when it completes">
              <Toggle checked={s.growth.referrals} onChange={(v) => set("growth", { referrals: v })} label="Referral programme on" />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Invitee discount (%)"><input type="number" min={0} max={50} className={input} value={s.growth.refereePercent} onChange={(e) => set("growth", { refereePercent: e.target.value })} /></Field>
                <Field label="Inviter reward ($)"><input type="number" min={0} className={input} value={s.growth.referrerReward} onChange={(e) => set("growth", { referrerReward: e.target.value })} /></Field>
                <Field label="New-account first-order discount (%, 0 = off)"><input type="number" min={0} max={50} className={input} value={s.growth.welcomePercent ?? 10} onChange={(e) => set("growth", { welcomePercent: e.target.value })} /></Field>
                <Field label="Welcome discount valid for (days)"><input type="number" min={1} max={365} className={input} value={s.growth.welcomeDays ?? 30} onChange={(e) => set("growth", { welcomeDays: e.target.value })} /></Field>
              </div>
            </Card>
          ) : null}
          {s.moderation ? (
            <Card title="Keyword filters & risk rules" subtitle="Applied to messages, custom offers, gigs, buyer requests and offers. Flags appear under Moderation → Risk flags">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Blocked words (refused; one per line)">
                  <textarea rows={5} aria-label="Blocked words" className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={Array.isArray(s.moderation.blockedWords) ? s.moderation.blockedWords.join("\n") : s.moderation.blockedWords} onChange={(e) => set("moderation", { blockedWords: e.target.value })} />
                </Field>
                <Field label="Flagged words (allowed, sent for review)">
                  <textarea rows={5} aria-label="Flagged words" className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={Array.isArray(s.moderation.flaggedWords) ? s.moderation.flaggedWords.join("\n") : s.moderation.flaggedWords} onChange={(e) => set("moderation", { flaggedWords: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3"><Toggle checked={s.moderation.flagContactInfo} onChange={(v) => set("moderation", { flagContactInfo: v })} label="Flag emails, phone numbers and messenger links in messages and offers" /></div>
              <div className="mt-2"><Toggle checked={s.moderation.maskContactBeforeOrder !== false} onChange={(v) => set("moderation", { maskContactBeforeOrder: v })} label="Hide contact details in messages until the two users have an order together" /></div>
              <div className="mt-2 max-w-xs"><Field label="New conversations per day" hint="How many new chats one person can start in 24 hours. 0 = no limit."><input type="number" min={0} max={1000} className={input} value={s.moderation.newChatsPerDay ?? 10} onChange={(e) => set("moderation", { newChatsPerDay: e.target.value })} /></Field></div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Flag orders from new accounts (< 3 days) at or above ($, 0 = off)"><input type="number" min={0} className={input} value={s.moderation.riskOrderAmount} onChange={(e) => set("moderation", { riskOrderAmount: e.target.value })} /></Field>
              </div>
            </Card>
          ) : null}
          <StorageCard />
        </div>
      ) : null}
    </div>
  );
}

// Unused local uploads (old avatars, removed gig images, replaced ID docs).
function StorageCard() {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async (method) => {
    if (method === "POST" && !window.confirm(`Delete ${r?.orphans} unused file(s)? This can't be undone.`)) return;
    setBusy(true);
    try {
      const x = await adminFetch("/admin/settings/storage/orphans", { method });
      setR(x);
      if (method === "POST") toast.success(`Deleted ${x.deleted} file(s)`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Storage" subtitle="Locally stored uploads nothing points to any more (older than 24h)">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" loading={busy} onClick={() => go("GET")}>Scan for unused files</Button>
        {r && r.orphans > 0 && !r.applied ? <Button variant="danger" loading={busy} onClick={() => go("POST")}>Delete {r.orphans} file(s)</Button> : null}
      </div>
      {r ? <p className="mt-3 text-sm text-ink-600">Scanned {r.scanned} file(s): {r.orphans} unused ({(r.orphanBytes / 1024).toFixed(0)} KB){r.applied ? `, ${r.deleted} deleted` : ""}. Images on ImgBB are not managed here.</p> : null}
    </Card>
  );
}

const SECTION_LABELS = {
  stats: "Marketplace stats",
  recentlyViewed: "Recently viewed (returning visitors only)",
  recommended: "Recommended gigs",
  categories: "Popular categories",
  howItWorks: "How it works (buyers / sellers)",
  freelancers: "Popular freelancers",
  whyUs: "Why choose us",
  testimonials: "Testimonials",
  join: "Join / become a seller",
  blog: "Latest news and blog",
};
const BLOCK_IDS = ["block-1", "block-2", "block-3", "block-4", "block-5"];

// Homepage builder: order and show/hide the sections under the hero, and
// write up to 5 custom text blocks that can be placed among them.
function HomepageBuilder({ home, onChange }) {
  const sections = home.sections || [];
  const blocks = home.blocks || [];
  const label = (key) => SECTION_LABELS[key] || `Custom: ${blocks.find((b) => b.id === key)?.title || key}`;
  const move = (i, d) => {
    const n = [...sections];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange({ sections: n });
  };
  const toggle = (i) => onChange({ sections: sections.map((x, k) => (k === i ? { ...x, enabled: !x.enabled } : x)) });
  const remove = (id) => onChange({ blocks: blocks.filter((b) => b.id !== id), sections: sections.filter((x) => x.key !== id) });
  const editBlock = (id, patch) => onChange({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const addBlock = () => {
    const id = BLOCK_IDS.find((x) => !blocks.some((b) => b.id === x));
    if (!id) return toast.error("At most 5 custom blocks");
    onChange({ blocks: [...blocks, { id, title: "New block", text: "", ctaLabel: "", ctaLink: "", tone: "light" }], sections: [{ key: id, enabled: true }, ...sections] });
  };
  return (
    <Card title="Homepage layout" subtitle="The hero is always first. Reorder with the arrows, hide sections, and add your own blocks. Save to publish (live within a minute).">
      <ol className="divide-y divide-ink-100 border border-ink-100 rounded-xl" data-testid="home-sections">
        {sections.map((x, i) => (
          <li key={x.key} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="w-5 text-ink-400 text-xs">{i + 1}</span>
            <span className={`flex-1 ${x.enabled ? "" : "text-ink-400 line-through"}`}>{label(x.key)}</span>
            <button type="button" aria-label={`Move ${x.key} up`} className="px-1.5 text-ink-500 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" aria-label={`Move ${x.key} down`} className="px-1.5 text-ink-500 disabled:opacity-30" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>↓</button>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`Show ${x.key}`} checked={x.enabled} onChange={() => toggle(i)} /> Show</label>
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-3">
        {blocks.map((b) => (
          <div key={b.id} className="rounded-xl border border-ink-200 p-3 space-y-2" data-testid={`block-${b.id}`}>
            <div className="flex items-center justify-between"><code className="text-xs text-ink-500">{b.id}</code><button type="button" className="text-xs text-rose-700" onClick={() => remove(b.id)}>Remove</button></div>
            <Field label="Title"><input aria-label={`${b.id} title`} className={input} maxLength={120} value={b.title} onChange={(e) => editBlock(b.id, { title: e.target.value })} /></Field>
            <Field label="Text"><textarea aria-label={`${b.id} text`} rows={3} maxLength={600} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={b.text} onChange={(e) => editBlock(b.id, { text: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Button label"><input aria-label={`${b.id} button label`} className={input} maxLength={40} value={b.ctaLabel} onChange={(e) => editBlock(b.id, { ctaLabel: e.target.value })} /></Field>
              <Field label="Button link"><input aria-label={`${b.id} button link`} className={input} placeholder="/gig" value={b.ctaLink} onChange={(e) => editBlock(b.id, { ctaLink: e.target.value })} /></Field>
              <Field label="Style"><select aria-label={`${b.id} style`} className={select} value={b.tone} onChange={(e) => editBlock(b.id, { tone: e.target.value })}><option value="light">Light</option><option value="brand">Brand</option><option value="dark">Dark</option></select></Field>
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={addBlock}>Add custom block</Button>
      </div>
    </Card>
  );
}

const toLocalInput = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

// Per-category platform fee overrides (applied when an order, milestone or
// tip is paid out; a sub-category rule beats its parent's).
function CategoryFees({ rules, base, onChange }) {
  const { data } = useAdminQuery("/categories?limit=500");
  const cats = data?.results || [];
  const name = (id) => cats.find((c) => c.id === id)?.name || "Unknown category";
  const free = cats.filter((c) => !rules.some((r) => r.categoryId === c.id));
  const edit = (i, patch) => onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <Card title="Category fees" subtitle={`Override the ${base}% platform fee for specific categories. Applies to orders completed after you save.`}>
      <div className="space-y-2" data-testid="category-fees">
        {rules.map((r, i) => (
          <div key={r.categoryId} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{name(r.categoryId)}</span>
            <input aria-label={`Fee for ${name(r.categoryId)}`} type="number" min={0} max={50} step="0.5" className={input + " w-24"} value={r.percent} onChange={(e) => edit(i, { percent: e.target.value })} />
            <span className="text-ink-500">%</span>
            <button type="button" className="text-xs text-rose-700" onClick={() => onChange(rules.filter((_, k) => k !== i))}>Remove</button>
          </div>
        ))}
        {!rules.length ? <p className="text-sm text-ink-500">No overrides: every category pays {base}%.</p> : null}
        {free.length ? (
          <select aria-label="Add category fee" className={select} value="" onChange={(e) => e.target.value && onChange([...rules, { categoryId: e.target.value, percent: base }])}>
            <option value="">Add a category…</option>
            {free.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "↳ " : ""}{c.name}</option>)}
          </select>
        ) : null}
      </div>
    </Card>
  );
}
