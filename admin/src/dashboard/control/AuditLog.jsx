// /dashboard/audit — every admin action (and denied attempt).
import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import StatusPill from "../../common/StatusPill";
import { qs, useAdminQuery } from "../../utils/adminApi";
import { formatDate } from "../../utils/format";
import { Empty, ErrorNote, input, Pager, Tabs, Td, Th } from "./ui";

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [denied, setDenied] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [params] = useSearchParams();
  const adminId = params.get("admin") || "";
  const { data, error } = useAdminQuery(`/admin/audit${qs({ search: term, denied, adminId, page, limit: 25 })}`);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who did what, when. Secrets in request bodies are redacted." />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Tabs tabs={[{ v: "", label: "All actions" }, { v: "true", label: "Denied attempts" }]} value={denied} onChange={(v) => { setDenied(v); setPage(1); }} />
          <form onSubmit={(e) => { e.preventDefault(); setTerm(search); setPage(1); }}><input className={input + " w-72"} placeholder="Filter by action, e.g. refund or users" value={search} onChange={(e) => setSearch(e.target.value)} /></form>
        </div>
        <ErrorNote error={error} />
        {data?.results?.length === 0 ? <Empty>No entries.</Empty> : null}
        {data?.results?.length ? (
          <table className="w-full" data-testid="audit-table">
            <thead className="border-b border-ink-100"><tr><Th>When</Th><Th>Admin</Th><Th>Action</Th><Th>Target</Th><Th>Result</Th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((a) => (
                <Fragment key={a.id}>
                  <tr className="cursor-pointer hover:bg-ink-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                    <Td className="text-xs whitespace-nowrap">{formatDate(a.createdAt, { withTime: true })}</Td>
                    <Td className="text-xs">{a.adminEmail}<div className="text-ink-500">{a.adminRole}</div></Td>
                    <Td><code className="text-xs">{a.action}</code><div className="text-[11px] text-ink-500">{a.permission}</div></Td>
                    <Td className="text-xs font-mono">{a.targetId ? a.targetId.slice(-8) : "—"}</Td>
                    <Td><StatusPill status={a.ok ? "ok" : "error"} label={String(a.status)} /></Td>
                  </tr>
                  {open === a.id ? (
                    <tr><td colSpan={5} className="bg-ink-50 px-3 py-2"><pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify({ path: a.path, ip: a.ip, body: a.body }, null, 2)}</pre></td></tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : null}
        <Pager data={data} page={page} setPage={setPage} />
      </Card>
    </div>
  );
}
