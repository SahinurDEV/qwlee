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
              <Field label="Platform fee (%)" hint="Taken from each completed order and tip (0–50)."><input type="number" min={0} max={50} step="0.5" className={input} value={s.marketplace.feePercent} onChange={(e) => set("marketplace", { feePercent: e.target.value })} /></Field>
              <Field label="Auto-complete after (days)" hint="A delivery the buyer ignores is accepted automatically (1–30)."><input type="number" min={1} max={30} className={input} value={s.marketplace.autoCompleteDays} onChange={(e) => set("marketplace", { autoCompleteDays: e.target.value })} /></Field>
            </div>
            <Toggle label="Demo payments" hint="Checkout completes without charging a card. Turn off in production." checked={s.marketplace.demoPayments} onChange={(v) => set("marketplace", { demoPayments: v })} />
            <Toggle label="Require gig approval" hint="New gigs start as 'pending' until a moderator approves them." checked={s.marketplace.requireGigApproval} onChange={(v) => set("marketplace", { requireGigApproval: v })} />
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
          <Card title="SEO" subtitle="Default title and description for search engines and link previews">
            <div className="space-y-3">
              <Field label={`Meta title (${s.seo.title.length}/70)`}><input className={input} maxLength={70} value={s.seo.title} onChange={(e) => set("seo", { title: e.target.value })} /></Field>
              <Field label={`Meta description (${s.seo.description.length}/170)`}><textarea rows={3} maxLength={170} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={s.seo.description} onChange={(e) => set("seo", { description: e.target.value })} /></Field>
              <Field label="Share image URL"><input className={input} value={s.seo.ogImage} onChange={(e) => set("seo", { ogImage: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="Payment providers & SMTP">
            <p className="text-sm text-ink-600">Provider keys, SMTP and email template previews live on the <a className="text-primary-700 underline" href="/dashboard/setting">Settings</a> page.</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
