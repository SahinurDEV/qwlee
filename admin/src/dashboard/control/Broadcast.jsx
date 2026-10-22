// /dashboard/broadcast — send an announcement as an in-app notification
// (and optionally email), now or at a scheduled time, to a targeted
// segment of users. Scheduled ones are sent by the background job.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate } from "../../utils/format";
import { Empty, ErrorNote, Field, input, select, Td, Th, Toggle, act } from "./ui";
import { confirmModal } from "../../common/confirm";

const EMPTY_TARGET = { location: "", joinedWithinDays: "", activeWithinDays: "", verifiedOnly: false, hasOrdered: "any" };
const STATUS_TONE = { sent: "ok", scheduled: "pending", sending: "pending", cancelled: "neutral", failed: "error" };

export default function Broadcast() {
  const [f, setF] = useState({ title: "", message: "", audience: "all", link: "", sendEmail: false, sendAt: "", target: EMPTY_TARGET });
  const [sending, setSending] = useState(false);
  const [reach, setReach] = useState(null);
  const { data, error, reload } = useAdminQuery("/admin/broadcast?limit=20");
  const setT = (patch) => setF((x) => ({ ...x, target: { ...x.target, ...patch } }));

  // Live audience size for the current targeting.
  const key = JSON.stringify([f.audience, f.target]);
  useEffect(() => {
    const t = setTimeout(() => {
      adminFetch("/admin/broadcast/preview", { method: "POST", body: { audience: f.audience, target: f.target } })
        .then(setReach)
        .catch(() => setReach(null));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const send = async () => {
    if (!f.title.trim() || !f.message.trim()) return toast.error("Title and message are required");
    const at = f.sendAt ? new Date(f.sendAt) : null;
    if (at && at <= new Date()) return toast.error("Pick a time in the future, or clear it to send now");
    const who = `${reach?.count ?? "?"} users`;
    if (!(await confirmModal({ title: at ? `Schedule for ${at.toLocaleString()}?` : `Send to ${who} now?`, description: `${at ? `It goes to whoever matches at that time (${who} today). ` : ""}${f.sendEmail ? "Each recipient also gets an email." : "Recipients get an in-app notification."}` }))) return;
    setSending(true);
    try {
      const r = await adminFetch("/admin/broadcast", { method: "POST", body: { ...f, sendAt: at ? at.toISOString() : undefined } });
      toast.success(r.announcement.status === "scheduled" ? "Scheduled" : `Sent to ${r.announcement.recipients} users`);
      setF({ ...f, title: "", message: "", link: "", sendAt: "" });
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <div>
      <PageHeader title="Announcements" subtitle="Message a segment of your users now or at a set time." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
        <Card title="New announcement">
          <div className="space-y-3" data-testid="broadcast-form">
            <Field label="Title"><input className={input} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Message"><textarea rows={5} maxLength={2000} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience"><select className={select} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Everyone</option><option value="buyers">Buyers</option><option value="sellers">Sellers</option></select></Field>
              <Field label="Link (optional)"><input className={input} placeholder="/requests" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
            </div>
            <details className="rounded-lg border border-ink-100 p-3" open>
              <summary className="text-sm font-medium cursor-pointer">Targeting</summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Location contains"><input aria-label="Location contains" className={input} placeholder="Bangladesh" value={f.target.location} onChange={(e) => setT({ location: e.target.value })} /></Field>
                <Field label="Has ordered">
                  <select aria-label="Has ordered" className={select} value={f.target.hasOrdered} onChange={(e) => setT({ hasOrdered: e.target.value })}><option value="any">Any</option><option value="yes">Has placed an order</option><option value="no">Never ordered</option></select>
                </Field>
                <Field label="Joined in the last (days)"><input aria-label="Joined within days" type="number" min={0} className={input} value={f.target.joinedWithinDays} onChange={(e) => setT({ joinedWithinDays: e.target.value })} /></Field>
                <Field label="Active in the last (days)"><input aria-label="Active within days" type="number" min={0} className={input} value={f.target.activeWithinDays} onChange={(e) => setT({ activeWithinDays: e.target.value })} /></Field>
              </div>
              <div className="mt-2"><Toggle label="ID-verified users only" checked={f.target.verifiedOnly} onChange={(v) => setT({ verifiedOnly: v })} /></div>
              <p className="text-sm mt-2" data-testid="reach">
                Matches <strong>{reach ? reach.count : "…"}</strong> users{reach?.sample?.length ? <span className="text-ink-500"> — e.g. {reach.sample.join(", ")}</span> : null}
              </p>
            </details>
            <Field label="Send at (optional, your local time)"><input aria-label="Send at" type="datetime-local" className={input} value={f.sendAt} onChange={(e) => setF({ ...f, sendAt: e.target.value })} /></Field>
            <Toggle label="Also send by email" hint="Uses the SMTP settings. Up to 2,000 recipients per send." checked={f.sendEmail} onChange={(v) => setF({ ...f, sendEmail: v })} />
            <Button loading={sending} onClick={send}>{f.sendAt ? "Schedule announcement" : "Send announcement"}</Button>
          </div>
        </Card>
        <Card title="History" bodyClassName="p-0">
          <ErrorNote error={error} />
          {data?.results?.length ? (
            <table className="w-full">
              <thead className="border-b border-ink-100"><tr><Th>Announcement</Th><Th>Audience</Th><Th>Reach</Th><Th>Status</Th><Th /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.results.map((a) => {
                  const t = a.target || {};
                  const bits = [t.location && `in “${t.location}”`, t.hasOrdered === "yes" && "ordered", t.hasOrdered === "no" && "never ordered", t.joinedWithinDays && `joined ≤${t.joinedWithinDays}d`, t.activeWithinDays && `active ≤${t.activeWithinDays}d`, t.verifiedOnly && "verified"].filter(Boolean);
                  return (
                    <tr key={a.id}>
                      <Td><div className="font-medium">{a.title}</div><div className="text-xs text-ink-500 line-clamp-2">{a.message}</div></Td>
                      <Td className="capitalize">{a.audience}{bits.length ? <div className="text-xs text-ink-500 normal-case">{bits.join(", ")}</div> : null}</Td>
                      <Td className="text-xs">{a.status === "sent" || !a.status ? `${a.recipients} in-app${a.sendEmail ? ` · ${a.emailed} emails` : ""}` : "—"}</Td>
                      <Td className="text-xs">
                        <StatusPill status={STATUS_TONE[a.status || "sent"] || "neutral"} label={a.status || "sent"} />
                        <div className="text-ink-500 mt-1">{a.status === "scheduled" ? `for ${formatDate(a.sendAt, { withTime: true })}` : formatDate(a.sentAt || a.createdAt, { withTime: true })}</div>
                        <div className="text-ink-500">{a.createdBy?.fullName}</div>
                      </Td>
                      <Td className="text-right">{a.status === "scheduled" ? <button className="text-xs text-rose-700" onClick={() => act({ title: "Cancel this scheduled announcement?", danger: true, path: `/admin/broadcast/${a.id}/cancel`, done: reload, success: "Cancelled" })}>Cancel</button> : null}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <Empty>No announcements yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
