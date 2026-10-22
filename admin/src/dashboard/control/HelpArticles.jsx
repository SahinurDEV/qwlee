// /dashboard/help — help centre / FAQ articles (content role).
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate } from "../../utils/format";
import { Empty, ErrorNote, Field, input, select, Td, Th, Toggle } from "./ui";

const BLANK = { id: null, title: "", slug: "", category: "General", audience: "all", body: "", published: true, order: 0 };

export default function HelpArticles() {
  const { data, error, loading, reload } = useAdminQuery("/admin/help");
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const rows = data?.results || [];
  const categories = [...new Set(rows.map((r) => r.category))];

  const save = async () => {
    setSaving(true);
    try {
      const { id, ...body } = f;
      await adminFetch(id ? `/admin/help/${id}` : "/admin/help", { method: id ? "PATCH" : "POST", body });
      toast.success(id ? "Article saved" : "Article created");
      setF(BLANK);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await adminFetch(`/admin/help/${a.id}`, { method: "DELETE" });
      if (f.id === a.id) setF(BLANK);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Help centre" subtitle="FAQ articles shown at /help. Plain text: blank lines make paragraphs, lines starting with '- ' make a list." />
      <Card title={f.id ? "Edit article" : "New article"}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2"><Field label="Title"><input className={input} value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} /></Field></div>
          <Field label="Category">
            <input className={input} list="help-cats" value={f.category} onChange={(e) => set({ category: e.target.value })} maxLength={60} />
            <datalist id="help-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="For">
            <select className={select} value={f.audience} onChange={(e) => set({ audience: e.target.value })}>
              <option value="all">Everyone</option>
              <option value="buyer">Buyers</option>
              <option value="seller">Sellers</option>
            </select>
          </Field>
          <div className="md:col-span-4"><Field label="Body"><textarea className={`${input} min-h-[180px]`} value={f.body} onChange={(e) => set({ body: e.target.value })} maxLength={20000} /></Field></div>
          <Field label="Slug" hint="Blank = from title"><input className={input} value={f.slug} onChange={(e) => set({ slug: e.target.value })} /></Field>
          <Field label="Order"><input type="number" className={input} value={f.order} onChange={(e) => set({ order: e.target.value })} /></Field>
          <div className="flex items-end"><Toggle checked={f.published} onChange={(v) => set({ published: v })} label="Published" /></div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button loading={saving} onClick={save} disabled={!f.title.trim()}>{f.id ? "Save" : "Create article"}</Button>
          {f.id ? <Button variant="ghost" onClick={() => setF(BLANK)}>Cancel</Button> : null}
        </div>
      </Card>
      <div className="mt-6">
        <ErrorNote error={error} />
        <Card>
          {!loading && rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Article</Th><Th>Category</Th><Th>Views</Th><Th>Helpful</Th><Th>Updated</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t border-ink-100">
                      <Td><div className="font-medium">{a.title}</div><div className="text-[11px] text-ink-500">/help/{a.slug} · {a.audience}</div></Td>
                      <Td>{a.category}</Td>
                      <Td>{a.views}</Td>
                      <Td>{a.helpfulYes} / {a.helpfulNo}</Td>
                      <Td>{formatDate(a.updatedAt)}</Td>
                      <Td><StatusPill status={a.published ? "active" : "draft"} /></Td>
                      <Td>
                        <div className="flex gap-3 justify-end">
                          <button type="button" className="text-primary-700 hover:underline" onClick={() => setF({ ...BLANK, ...a, body: a.body || "" })}>Edit</button>
                          <button type="button" className="text-rose-600 hover:underline" onClick={() => remove(a)}>Delete</button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
