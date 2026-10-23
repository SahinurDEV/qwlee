// /dashboard/appeals — banned users asking for their suspension to be lifted.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery, qs } from "../../utils/adminApi";
import { formatDate, timeAgo } from "../../utils/format";
import { Empty, ErrorNote, Pager, Tabs, Td, Th, act } from "./ui";

const TABS = [
  { v: "open", label: "Open" },
  { v: "accepted", label: "Accepted" },
  { v: "rejected", label: "Rejected" },
  { v: "all", label: "All" },
];

export default function Appeals() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(`/admin/appeals${qs({ status, page })}`);
  const decide = (a, decision) =>
    act({
      title: decision === "accepted" ? "Accept and lift the ban" : "Reject the appeal",
      askReason: "Reply emailed to the user (optional)",
      method: "PATCH",
      path: `/admin/appeals/${a.id}`,
      body: { decision },
      done: reload,
      success: decision === "accepted" ? "Ban lifted" : "Appeal rejected",
    });
  return (
    <div>
      <PageHeader title="Ban appeals" subtitle="Suspended users can appeal from the sign-in page. Accepting lifts the ban; the user is emailed either way." />
      <ErrorNote error={error} />
      <Card bodyClassName="p-0">
        <div className="p-4 border-b border-ink-100"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS} /></div>
        {data?.results?.length ? (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>User</Th><Th>Ban</Th><Th>Appeal</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((a) => (
                <tr key={a.id}>
                  <Td><div className="font-medium">{a.userId?.fullName || "—"}</div><div className="text-xs text-ink-500">{a.userId?.email}</div></Td>
                  <Td><div className="text-sm max-w-xs">{a.banReason || "—"}</div>{a.userId?.bannedUntil ? <div className="text-xs text-ink-500">until {formatDate(a.userId.bannedUntil)}</div> : a.userId?.isBan ? <div className="text-xs text-ink-500">permanent</div> : null}</Td>
                  <Td><div className="text-sm max-w-md whitespace-pre-line">{a.message}</div><div className="text-xs text-ink-500">{timeAgo(a.createdAt)}</div></Td>
                  <Td><StatusPill status={a.status === "open" ? "pending" : a.status === "accepted" ? "ok" : "error"} label={a.status} />{a.decidedBy ? <div className="text-xs text-ink-500 mt-1">by {a.decidedBy.fullName}</div> : null}{a.reply ? <div className="text-xs text-ink-500">{a.reply}</div> : null}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {a.status === "open" ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => decide(a, "accepted")}>Accept</Button>
                        <Button size="sm" variant="danger" onClick={() => decide(a, "rejected")}>Reject</Button>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : !loading ? <Empty>No {status === "all" ? "" : status} appeals.</Empty> : null}
        <div className="px-4 pb-4"><Pager data={data} page={page} setPage={setPage} /></div>
      </Card>
    </div>
  );
}
