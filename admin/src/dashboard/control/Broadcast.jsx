// /dashboard/broadcast — send an announcement to all users, buyers or
// sellers as an in-app notification (and optionally email).
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate } from "../../utils/format";
import { Empty, ErrorNote, Field, input, select, Td, Th, Toggle } from "./ui";
import { confirmModal } from "../../common/confirm";

export default function Broadcast() {
  const [f, setF] = useState({ title: "", message: "", audience: "all", link: "", sendEmail: false });
  const [sending, setSending] = useState(false);
  const { data, error, reload } = useAdminQuery("/admin/broadcast?limit=20");
  const send = async () => {
    if (!f.title.trim() || !f.message.trim()) return toast.error("Title and message are required");
    if (!(await confirmModal({ title: `Send to ${f.audience === "all" ? "all users" : f.audience}?`, description: f.sendEmail ? "Each recipient also gets an email." : "Recipients get an in-app notification." }))) return;
    setSending(true);
    try {
      const r = await adminFetch("/admin/broadcast", { method: "POST", body: f });
      toast.success(`Sent to ${r.announcement.recipients} users`);
      setF({ ...f, title: "", message: "", link: "" });
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <div>
      <PageHeader title="Announcements" subtitle="Broadcast a message to your users." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
        <Card title="New announcement">
          <div className="space-y-3" data-testid="broadcast-form">
            <Field label="Title"><input className={input} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Message"><textarea rows={5} maxLength={2000} className="w-full rounded-lg border border-ink-200 p-2 text-sm" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience"><select className={select} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Everyone</option><option value="buyers">Buyers</option><option value="sellers">Sellers</option></select></Field>
              <Field label="Link (optional)"><input className={input} placeholder="/requests" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
            </div>
            <Toggle label="Also send by email" hint="Uses the SMTP settings. Up to 2,000 recipients per send." checked={f.sendEmail} onChange={(v) => setF({ ...f, sendEmail: v })} />
            <Button loading={sending} onClick={send}>Send announcement</Button>
          </div>
        </Card>
        <Card title="History" bodyClassName="p-0">
          <ErrorNote error={error} />
          {data?.results?.length ? (
            <table className="w-full">
              <thead className="border-b border-ink-100"><tr><Th>Announcement</Th><Th>Audience</Th><Th>Reach</Th><Th>Sent</Th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.results.map((a) => (
                  <tr key={a.id}>
                    <Td><div className="font-medium">{a.title}</div><div className="text-xs text-ink-500 line-clamp-2">{a.message}</div></Td>
                    <Td className="capitalize">{a.audience}</Td>
                    <Td className="text-xs">{a.recipients} in-app{a.sendEmail ? ` · ${a.emailed} emails` : ""}</Td>
                    <Td className="text-xs">{formatDate(a.createdAt, { withTime: true })}<div className="text-ink-500">{a.createdBy?.fullName}</div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No announcements yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
