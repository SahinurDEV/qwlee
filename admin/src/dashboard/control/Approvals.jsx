// /dashboard/approvals — four-eyes queue for large refunds and payouts.
// The threshold is set in Site settings → Marketplace.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery, qs } from "../../utils/adminApi";
import { timeAgo } from "../../utils/format";
import { Empty, ErrorNote, Pager, Tabs, Td, Th, act } from "./ui";

const TABS = [
  { v: "pending", label: "Pending" },
  { v: "approved", label: "Approved" },
  { v: "rejected", label: "Rejected" },
  { v: "failed", label: "Failed" },
];

export default function Approvals() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(`/admin/approvals${qs({ status, page })}`);
  const me = useAdminQuery("/admin/me").data;
  return (
    <div>
      <PageHeader title="Approvals" subtitle="Large refunds and payouts need a second admin. Approving runs the action as you." />
      <ErrorNote error={error} />
      <Card bodyClassName="p-0">
        <div className="p-4 border-b border-ink-100"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS} /></div>
        {data?.results?.length ? (
          <table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>What</Th><Th>Amount</Th><Th>Requested by</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((a) => {
                const mine = me && String(a.requestedBy?._id || a.requestedBy) === String(me.id);
                return (
                  <tr key={a.id}>
                    <Td><div className="font-medium capitalize">{a.kind}</div><div className="text-xs text-ink-500">{a.summary || a.targetId}</div>{a.body?.reason ? <div className="text-xs text-ink-500">Reason: {a.body.reason}</div> : null}</Td>
                    <Td className="font-semibold">${Number(a.amount || 0).toLocaleString()}</Td>
                    <Td><div className="text-sm">{a.requestedBy?.fullName || "—"}</div><div className="text-xs text-ink-500">{timeAgo(a.createdAt)}</div></Td>
                    <Td><StatusPill status={a.status === "approved" ? "ok" : a.status === "pending" ? "pending" : "error"} label={a.status} />{a.decidedBy ? <div className="text-xs text-ink-500 mt-1">by {a.decidedBy.fullName}</div> : null}{a.result && a.status !== "pending" ? <div className="text-xs text-ink-500">{a.result}</div> : null}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {a.status === "pending" ? (
                        mine ? <span className="text-xs text-ink-500">Waiting for another admin</span> : (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => act({ title: `Approve this ${a.kind}?`, description: `$${a.amount} will be moved now, recorded under your name.`, path: `/admin/approvals/${a.id}/approve`, done: reload, success: "Approved and executed" })}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => act({ title: "Reject request", askReason: "Why?", path: `/admin/approvals/${a.id}/reject`, done: reload, success: "Rejected" })}>Reject</Button>
                          </div>
                        )
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : !loading ? <Empty>No {status} approvals.</Empty> : null}
        <div className="px-4 pb-4"><Pager data={data} page={page} setPage={setPage} /></div>
      </Card>
    </div>
  );
}
