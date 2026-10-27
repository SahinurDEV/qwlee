// /dashboard/email-templates — CMS-style visual email builder.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { ErrorNote, Field, input, Toggle } from "./ui";

const label = (k) => k.replace(/^send/, "").replace(/([A-Z])/g, " $1").trim();
const EMPTY = { subject: "", heroTitle: "", intro: "", footerNote: "", ctaLabel: "", disabled: false, blocks: [] };
const BLOCK_TYPES = [
  { type: "header", label: "Header / logo" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "image", label: "Image" },
  { type: "divider", label: "Divider" },
  { type: "footer", label: "Footer" },
];
const uid = () => `b${Math.random().toString(36).slice(2, 9)}`;

export default function EmailTemplates() {
  const { data, error, reload } = useAdminQuery("/admin/email-templates");
  const list = data?.results || [];
  const [key, setKey] = useState("");
  const cur = list.find((t) => t.key === key);
  const [f, setF] = useState(EMPTY);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("visual"); // visual | fields
  const [device, setDevice] = useState("desktop");
  useEffect(() => { if (!key && list.length) setKey(list[0].key); }, [list, key]);
  useEffect(() => {
    if (!cur) return;
    const o = cur.override || {};
    setF({
      ...EMPTY,
      ...o,
      blocks: Array.isArray(o.blocks) && o.blocks.length
        ? o.blocks
        : defaultBlocks(cur),
    });
  }, [key, cur?.override?.updatedAt]); // eslint-disable-line
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => adminFetch(`/admin/email-templates/${key}/preview`, { method: "POST", body: { draft: f } }).then(setPrev).catch(() => {}), 280);
    return () => clearTimeout(t);
  }, [key, f]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setBlock = (id, patch) => setF((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const addBlock = (type) => setF((x) => ({ ...x, blocks: [...x.blocks, { id: uid(), type, text: type === "header" ? "Qwlee" : type === "button" ? "View order" : "", url: type === "button" ? "{{chatUrl}}" : "", align: "left", style: "brand" }] }));
  const removeBlock = (id) => setF((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) }));
  const move = (id, dir) => setF((x) => {
    const i = x.blocks.findIndex((b) => b.id === id);
    if (i < 0) return x;
    const j = i + dir;
    if (j < 0 || j >= x.blocks.length) return x;
    const blocks = [...x.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return { ...x, blocks };
  });

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
    try {
      await adminFetch(`/admin/email-templates/${key}`, { method: "PUT", body: f });
      const r = await adminFetch(`/admin/email-templates/${key}/test`, { method: "POST" });
      r.sent ? toast.success(`Test sent to ${r.to}`) : toast.error("Email isn't configured (SMTP / Mailpit)");
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const restore = async (index) => {
    try { await adminFetch(`/admin/email-templates/${key}/restore`, { method: "POST", body: { index } }); toast.success("Version restored"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  const vars = useMemo(() => cur?.variables || [], [cur]);

  return (
    <div className="space-y-4" data-testid="email-cms">
      <PageHeader title="Email templates" subtitle="No-code visual builder — drag blocks, insert variables, preview desktop/mobile, send a test to Mailpit." />
      <ErrorNote error={error} />
      <div className="grid lg:grid-cols-[220px_1fr_minmax(280px,380px)] gap-4">
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
            <Card
              title={label(cur.key)}
              subtitle="Click a variable to copy it into the focused field"
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => setMode(mode === "visual" ? "fields" : "visual")}>{mode === "visual" ? "Simple fields" : "Visual builder"}</Button>
                  <Button size="sm" variant="secondary" onClick={test}>Send test</Button>
                  <Button size="sm" variant="secondary" onClick={reset} disabled={!cur.override}>Reset</Button>
                  <Button size="sm" loading={busy} onClick={save}>Save</Button>
                </>
              }
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {vars.map((v) => (
                  <button key={v} type="button" className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 hover:bg-emerald-100" onClick={() => { navigator.clipboard?.writeText(`{{${v}}}`); toast.success(`{{${v}}} copied`); }}>{`{{${v}}}`}</button>
                ))}
              </div>
              <Field label="Subject"><input aria-label="Subject" className={input} maxLength={200} value={f.subject} onChange={(e) => set({ subject: e.target.value })} placeholder={prev?.builtIn?.subject} /></Field>

              {mode === "fields" ? (
                <div className="space-y-3 mt-3">
                  <Field label="Heading"><input aria-label="Heading" className={input} maxLength={200} value={f.heroTitle} onChange={(e) => set({ heroTitle: e.target.value })} /></Field>
                  <Field label="Intro"><textarea aria-label="Intro" rows={3} maxLength={2000} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={f.intro} onChange={(e) => set({ intro: e.target.value })} /></Field>
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Footer note"><input aria-label="Footer note" className={input} maxLength={1000} value={f.footerNote} onChange={(e) => set({ footerNote: e.target.value })} /></Field>
                    <Field label="Button label"><input aria-label="Button label" className={input} maxLength={60} value={f.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2" data-testid="block-editor">
                  <div className="flex flex-wrap gap-1.5">
                    {BLOCK_TYPES.map((b) => (
                      <button key={b.type} type="button" onClick={() => addBlock(b.type)} className="text-xs px-2 py-1 rounded-lg border border-ink-200 hover:bg-ink-50">+ {b.label}</button>
                    ))}
                  </div>
                  {(f.blocks || []).map((b) => (
                    <div key={b.id} className="rounded-xl border border-ink-200 p-3 bg-ink-50/40 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">{b.type}</span>
                        <div className="flex gap-1">
                          <button type="button" className="text-xs px-1.5 py-0.5 rounded border" onClick={() => move(b.id, -1)}>↑</button>
                          <button type="button" className="text-xs px-1.5 py-0.5 rounded border" onClick={() => move(b.id, 1)}>↓</button>
                          <button type="button" className="text-xs px-1.5 py-0.5 rounded border text-rose-700" onClick={() => removeBlock(b.id)}>Remove</button>
                        </div>
                      </div>
                      {b.type !== "divider" && b.type !== "image" ? (
                        <textarea className="w-full rounded-lg border border-ink-200 p-2 text-sm" rows={b.type === "text" || b.type === "footer" ? 3 : 1} value={b.text} onChange={(e) => setBlock(b.id, { text: e.target.value })} placeholder={b.type === "button" ? "Button label" : "Text (supports {{variables}})"} />
                      ) : null}
                      {(b.type === "button" || b.type === "image") ? (
                        <input className={input} value={b.url} onChange={(e) => setBlock(b.id, { url: e.target.value })} placeholder={b.type === "image" ? "Image URL" : "https://… or {{chatUrl}}"} />
                      ) : null}
                      <div className="flex gap-2">
                        <select className="border rounded-lg text-xs px-2 py-1" value={b.align} onChange={(e) => setBlock(b.id, { align: e.target.value })}>
                          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cur.canDisable ? <div className="mt-3"><Toggle label="Turn this email off" hint={`Optional (${cur.category}) email`} checked={f.disabled} onChange={(v) => set({ disabled: v })} /></div> : <p className="text-xs text-ink-500 mt-3">This email always goes out (sign-in, password, money or moderation).</p>}

              {cur.override?.versions?.length ? (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <div className="text-xs font-semibold text-ink-700 mb-2">Versions</div>
                  <ul className="space-y-1">
                    {cur.override.versions.slice(0, 5).map((v, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-ink-600">
                        <span>{v.at ? new Date(v.at).toLocaleString() : `v${i}`}</span>
                        <button type="button" className="text-primary-700 underline" onClick={() => restore(i)}>Restore</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        <Card
          title="Live preview"
          subtitle={prev?.custom ? `Subject: ${prev.custom.subject}` : ""}
          actions={
            <div className="flex gap-1">
              <button type="button" className={`text-xs px-2 py-1 rounded ${device === "desktop" ? "bg-ink-900 text-white" : "border"}`} onClick={() => setDevice("desktop")}>Desktop</button>
              <button type="button" className={`text-xs px-2 py-1 rounded ${device === "mobile" ? "bg-ink-900 text-white" : "border"}`} onClick={() => setDevice("mobile")}>Mobile</button>
            </div>
          }
        >
          <div className={`mx-auto ${device === "mobile" ? "max-w-[375px]" : "w-full"}`}>
            {prev?.custom ? <iframe title="Email preview" data-testid="preview" sandbox="" srcDoc={prev.custom.html} className="w-full h-[640px] rounded-lg border border-ink-100 bg-white" /> : <div className="text-sm text-ink-500 p-6 text-center">Preview loads as you edit…</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function defaultBlocks(cur) {
  return [
    { id: uid(), type: "header", text: "Qwlee", align: "center", style: "brand", url: "" },
    { id: uid(), type: "text", text: cur?.override?.intro || "Hello {{buyerName}},\n\nThanks for using Qwlee.", align: "left", style: "light", url: "" },
    { id: uid(), type: "button", text: cur?.override?.ctaLabel || "Open Qwlee", url: "{{chatUrl}}", align: "center", style: "brand" },
    { id: uid(), type: "footer", text: cur?.override?.footerNote || "You received this email from Qwlee.", align: "center", style: "light", url: "" },
  ];
}
