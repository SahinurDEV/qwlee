// /dashboard/pro — vetted Pro seller applications (approve / reject) and
// removing Pro from a seller.
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate } from "../../utils/format";
import { ErrorNote } from "./ui";

export default function ProApplications() {
  const [status, setStatus] = useState("pending");
  const { data, error, reload } = useAdminQuery(`/admin/pro-applications?status=${status}`);
  const decide = async (id, approve) => {
    const note = approve ? "" : window.prompt("Reason shown to the seller (optional)") ?? "";
    try {
      await adminFetch(`/admin/users/${id}/pro`, { method: "POST", body: { approve, note } });
      toast.success(approve ? "Approved as Pro" : "Rejected");
      reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Pro applications" subtitle="Vetted Pro sellers get a Pro badge and appear under the marketplace Pro filter." actions={
        <select aria-label="Status" className="border border-ink-200 rounded-lg px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["pending", "approved", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      } />
      <ErrorNote error={error} />
      {(data?.results || []).length === 0 ? <Card><p className="text-sm text-ink-500">No {status} applications.</p></Card> : null}
      {(data?.results || []).map((u) => {
        const a = u.proApplication || {};
        return (
          <Card key={u._id || u.id}>
            <div className="flex items-start justify-between gap-4 flex-wrap" data-testid="pro-application">
              <div className="text-sm space-y-1">
                <div className="font-semibold text-base">{u.fullName} <span className="text-ink-500 font-normal">@{u.username} · {u.email}</span></div>
                <div>{a.headline}</div>
                <div className="text-ink-600">{a.experienceYears} years · rating {Number(u.review?.rating || 0).toFixed(1)} ({u.review?.total || 0}) · applied {a.submittedAt ? formatDate(a.submittedAt) : "—"}</div>
                {a.clients ? <div className="text-ink-600">Clients: {a.clients}</div> : null}
                <ul className="list-disc pl-5">{(a.portfolioLinks || []).map((l) => <li key={l}><a className="text-emerald-700 underline break-all" href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a></li>)}</ul>
                {a.reviewNote ? <div className="text-ink-500">Note: {a.reviewNote}</div> : null}
              </div>
              <div className="flex gap-2">
                {status !== "approved" && <Button onClick={() => decide(u._id || u.id, true)}>Approve</Button>}
                <Button variant="secondary" onClick={() => decide(u._id || u.id, false)}>{status === "approved" ? "Remove Pro" : "Reject"}</Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
