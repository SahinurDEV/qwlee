// /dashboard/risk-flags — items the keyword filters and risk rules want a
// moderator to look at. Rules are set in Site settings → Keyword filters.
import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery, qs } from "../../utils/adminApi";
import { timeAgo } from "../../utils/format";
import { Empty, ErrorNote, Pager, Tabs, Td, Th, act } from "./ui";

const TABS = [
  { v: "open", label: "Open" },
  { v: "actioned", label: "Actioned" },
  { v: "dismissed", label: "Dismissed" },
  { v: "all", label: "All" },
];
const KINDS = ["", "chat", "message", "offer", "gig", "request", "order"];
const REASON = (r) =>
  r.startsWith("keyword:") ? `Word “${r.slice(8)}”` :
  ({ "contact:email": "Email address", "contact:phone": "Phone number", "contact:messenger": "Messenger link", "new-account-large-order": "Large order, new account", "order-burst": "3+ orders in an hour" })[r] || (r.startsWith("report:") ? `Reported: ${r.slice(7)}` : r);

function targetLink(f) {
  if (f.kind === "chat") return `/dashboard/conversations?chat=${f.targetId}`;
  if (f.kind === "gig") return "/dashboard/gigs";
  if (f.kind === "order") return "/dashboard/orders";
  if (f.kind === "request" || f.kind === "offer") return "/dashboard/moderation";
  return null;
}

export default function RiskFlags() {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(`/admin/risk-flags${qs({ status, kind, page })}`);
  const review = (f, next, title) =>
    act({ title, askReason: next === "open" ? undefined : "Note (optional)", description: next === "open" ? "Move it back to the open queue." : undefined, method: "PATCH", path: `/admin/risk-flags/${f.id}`, body: { status: next }, done: reload, success: "Updated" });
  return (
    <div>
      <PageHeader title="Risk flags" subtitle="Messages, listings and orders caught by the keyword filters and risk rules." />
      <ErrorNote error={error} />
      <Card bodyClassName="p-0">
        <div className="p-4 border-b border-ink-100 flex flex-wrap gap-3 items-center">
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS} />
          <select aria-label="Kind" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="border border-ink-200 rounded-lg px-2 py-1.5 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{k ? k[0].toUpperCase() + k.slice(1) + "s" : "All kinds"}</option>)}
          </select>
        </div>
        {data?.results?.length ? (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>What</Th><Th>Why</Th><Th>Who</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((f) => {
                const to = targetLink(f);
                return (
                  <tr key={f.id}>
                    <Td>
                      <div className="font-medium capitalize">{f.kind}</div>
                      <div className="text-xs text-ink-600 max-w-md break-words">{f.excerpt}</div>
                      <div className="text-xs text-ink-400 font-mono">{f.targetId}</div>
                      {to ? <Link to={to} className="text-xs text-primary-700 underline">Open</Link> : null}
                    </Td>
                    <Td><div className="flex flex-wrap gap-1">{f.reasons.map((r) => <span key={r} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">{REASON(r)}</span>)}</div></Td>
                    <Td><div className="text-sm">{f.userId?.fullName || "—"}</div><div className="text-xs text-ink-500">{f.userId?.email}</div>{f.reportedBy ? <div className="text-xs text-ink-500">Reported by {f.reportedBy.fullName || f.reportedBy.email}</div> : null}<div className="text-xs text-ink-500">{timeAgo(f.createdAt)}</div></Td>
                    <Td><StatusPill status={f.status === "open" ? "pending" : f.status === "actioned" ? "error" : "ok"} label={f.status} />{f.note ? <div className="text-xs text-ink-500 mt-1">{f.note}</div> : null}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {f.status === "open" ? (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => review(f, "dismissed", "Dismiss flag")}>Dismiss</Button>
                          <Button size="sm" variant="danger" onClick={() => review(f, "actioned", "Mark as actioned")}>Actioned</Button>
                        </div>
                      ) : <Button size="sm" variant="ghost" onClick={() => review(f, "open", "Reopen flag?")}>Reopen</Button>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : !loading ? <Empty>No {status === "all" ? "" : status} flags.</Empty> : null}
        <div className="px-4 pb-4"><Pager data={data} page={page} setPage={setPage} /></div>
      </Card>
    </div>
  );
}
