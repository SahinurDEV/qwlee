// /dashboard/email-templates — edit the text of each transactional email
// (subject, heading, intro, footer note, button label) with {{variables}},
// preview against the built-in version, send a test to yourself, reset.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { ErrorNote, Field, input, Toggle } from "./ui";

const label = (k) => k.replace(/^send/, "").replace(/([A-Z])/g, " $1").trim();
const EMPTY = { subject: "", heroTitle: "", intro: "", footerNote: "", ctaLabel: "", disabled: false };

export default function EmailTemplates() {
  const { data, error, reload } = useAdminQuery("/admin/email-templates");
  const list = data?.results || [];
  const [key, setKey] = useState("");
  const cur = list.find((t) => t.key === key);
  const [f, setF] = useState(EMPTY);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!key && list.length) setKey(list[0].key); }, [list, key]);
  useEffect(() => { if (cur) setF({ ...EMPTY, ...(cur.override || {}) }); }, [key, cur?.override?.updatedAt]); // eslint-disable-line
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => adminFetch(`/admin/email-templates/${key}/preview`, { method: "POST", body: { draft: f } }).then(setPrev).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [key, f]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try { await adminFetch(`/admin/email-templates/${key}`, { method: "PUT", body: f }); toast.success("Template saved"); reload(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm("Reset this email to the built-in text?")) return;
    try { await adminFetch(`/admin/email-templates/${key}`, { method: "DELETE" }); setF(EMPTY); toast.success("Reset to built-in"); reload(); }
    catch (e) { toast.error(e.message); }
  };
  const test = async () => {
    try { const r = await adminFetch(`/admin/email-templates/${key}/test`, { method: "POST" }); r.sent ? toast.success(`Test sent to ${r.to} (saved version)`) : toast.error("Email isn't configured (SMTP)"); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Email templates" subtitle="Change the wording of each email. Empty fields keep the built-in text. Layout, order details and links stay built-in." />
      <ErrorNote error={error} />
      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <Card title="Emails">
          <ul className="text-sm -mx-2" data-testid="template-list">
            {list.map((t) => (
              <li key={t.key}>
                <button type="button" onClick={() => setKey(t.key)} className={`w-full text-left px-2 py-1.5 rounded-lg ${t.key === key ? "bg-emerald-50 text-emerald-800 font-medium" : "hover:bg-ink-50"}`}>
                  {label(t.key)} {t.override ? <span className="text-[10px] uppercase text-amber-700">{t.override.disabled ? "off" : "edited"}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {cur ? (
          <div className="space-y-4">
            <Card title={label(cur.key)} subtitle={`Variables: ${cur.variables.map((v) => `{{${v}}}`).join(" ")}`} actions={<><Button size="sm" variant="secondary" onClick={test}>Send test to me</Button> <Button size="sm" variant="secondary" onClick={reset} disabled={!cur.override}>Reset</Button> <Button size="sm" loading={busy} onClick={save}>Save</Button></>}>
              <div className="space-y-3">
                <Field label="Subject" hint="{{subject}} is the built-in subject."><input aria-label="Subject" className={input} maxLength={200} placeholder={prev?.builtIn?.subject} value={f.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
                <Field label="Heading"><input aria-label="Heading" className={input} maxLength={200} value={f.heroTitle} onChange={(e) => set({ heroTitle: e.target.value })} /></Field>
                <Field label="Intro" hint="Plain text; new lines are kept."><textarea aria-label="Intro" rows={3} maxLength={2000} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={f.intro} onChange={(e) => set({ intro: e.target.value })} /></Field>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Footer note"><input aria-label="Footer note" className={input} maxLength={1000} value={f.footerNote} onChange={(e) => set({ footerNote: e.target.value })} /></Field>
                  <Field label="Button label"><input aria-label="Button label" className={input} maxLength={60} value={f.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
                </div>
                {cur.canDisable ? <Toggle label="Turn this email off" hint={`Optional (${cur.category}) email; users can also turn it off themselves.`} checked={f.disabled} onChange={(v) => set({ disabled: v })} /> : <p className="text-xs text-ink-500">This email always goes out (sign-in, password, money or moderation).</p>}
              </div>
            </Card>
            <Card title="Preview (sample data)" subtitle={prev?.custom ? `Subject: ${prev.custom.subject}` : ""}>
              {prev?.custom ? <iframe title="Email preview" data-testid="preview" sandbox="" srcDoc={prev.custom.html} className="w-full h-[640px] rounded-lg border border-ink-100 bg-white" /> : null}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
