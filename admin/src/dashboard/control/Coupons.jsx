// /dashboard/coupons — platform-funded discount codes (finance).
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { adminFetch, qs, useAdminQuery } from "../../utils/adminApi";
import { formatDate, formatMoney } from "../../utils/format";
import { Empty, ErrorNote, Field, input, select, Tabs, Td, Th, Toggle } from "./ui";

const BLANK = { code: "", type: "percent", value: 10, maxDiscount: "", minOrder: "", maxUses: "", perUserLimit: 1, expiresAt: "", firstOrderOnly: false, note: "" };

export default function Coupons() {
  const [source, setSource] = useState("admin");
  const { data, error, loading, reload } = useAdminQuery(`/admin/coupons${qs({ source })}`);
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const create = async () => {
    setSaving(true);
    try {
      await adminFetch("/admin/coupons", { method: "POST", body: { ...f, expiresAt: f.expiresAt || null } });
      toast.success("Coupon created");
      setF(BLANK);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (c) => {
    try {
      await adminFetch(`/admin/coupons/${c.id}`, { method: "PATCH", body: { active: !c.active } });
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const rows = data?.results || [];
  return (
    <div>
      <PageHeader title="Coupons" subtitle="Discount codes buyers enter at checkout. The platform pays the discount; sellers are paid on the full price." />
      <Card title="New coupon">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Code"><input className={input} value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="SPRING10" /></Field>
          <Field label="Type">
            <select className={select} value={f.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed $ off</option>
            </select>
          </Field>
          <Field label={f.type === "percent" ? "Percent" : "Amount ($)"}><input type="number" min={0} className={input} value={f.value} onChange={(e) => set({ value: e.target.value })} /></Field>
          <Field label="Max discount ($)" hint="Percent only, blank = no cap"><input type="number" min={0} className={input} value={f.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} /></Field>
          <Field label="Minimum order ($)"><input type="number" min={0} className={input} value={f.minOrder} onChange={(e) => set({ minOrder: e.target.value })} /></Field>
          <Field label="Total uses" hint="Blank = unlimited"><input type="number" min={1} className={input} value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value })} /></Field>
          <Field label="Uses per buyer"><input type="number" min={1} className={input} value={f.perUserLimit} onChange={(e) => set({ perUserLimit: e.target.value })} /></Field>
          <Field label="Expires"><input type="date" className={input} value={f.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} /></Field>
          <div className="md:col-span-3"><Field label="Note"><input className={input} value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} /></Field></div>
          <div className="flex items-end"><Toggle checked={f.firstOrderOnly} onChange={(v) => set({ firstOrderOnly: v })} label="First order only" /></div>
        </div>
        <div className="mt-3"><Button loading={saving} onClick={create} disabled={!f.code}>Create coupon</Button></div>
      </Card>
      <div className="mt-6">
        <Tabs tabs={[{ v: "admin", label: "Admin coupons" }, { v: "referral", label: "Referral rewards" }]} value={source} onChange={setSource} />
        <ErrorNote error={error} />
        <Card>
          {!loading && rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Code</Th><Th>Discount</Th><Th>Uses</Th><Th>Given</Th><Th>Expires</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-t border-ink-100">
                      <Td><span className="font-mono font-semibold">{c.code}</span>{c.note ? <div className="text-xs text-ink-500">{c.note}</div> : null}</Td>
                      <Td>{c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${formatMoney(c.maxDiscount)})` : ""}` : formatMoney(c.value)}{c.minOrder ? <div className="text-xs text-ink-500">min {formatMoney(c.minOrder)}</div> : null}{c.firstOrderOnly ? <div className="text-xs text-ink-500">first order</div> : null}</Td>
                      <Td>{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</Td>
                      <Td>{formatMoney(c.discountGiven)}</Td>
                      <Td>{c.expiresAt ? formatDate(c.expiresAt) : "—"}</Td>
                      <Td><StatusPill status={c.active ? "ok" : "error"} label={c.active ? "Active" : "Off"} /></Td>
                      <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => toggle(c)}>{c.active ? "Turn off" : "Turn on"}</Button></Td>
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
