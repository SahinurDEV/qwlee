// /dashboard/newsletter — people who subscribed from the site footer.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery, qs } from "../../utils/adminApi";
import url from "../../baseUrl";
import { timeAgo } from "../../utils/format";
import { Empty, ErrorNote, Pager, Td, Th } from "./ui";

export default function Newsletter() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, error, loading } = useAdminQuery(`/admin/newsletter${qs({ page, limit: 25, search, status })}`);
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`${url}/v1/admin/newsletter${qs({ format: "csv", search, status })}`, {
        headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "subscribers.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Newsletter"
        subtitle="Email addresses collected from the site footer."
        actions={<Button onClick={exportCsv} disabled={exporting}>{exporting ? "Exporting…" : "Export CSV"}</Button>}
      />
      <ErrorNote error={error} />
      <Card bodyClassName="p-0">
        <div className="flex flex-wrap gap-2 p-4 border-b border-ink-100">
          <input
            aria-label="Search email"
            placeholder="Search email"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-ink-200 rounded-lg"
          />
          <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-ink-200 rounded-lg">
            <option value="">All</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
        {data?.results?.length ? (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b border-ink-100"><tr><Th>Email</Th><Th>Status</Th><Th>Source</Th><Th>Subscribed</Th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.results.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.email}</Td>
                  <Td><StatusPill status={r.status === "subscribed" ? "ok" : "neutral"} label={r.status} /></Td>
                  <Td className="text-xs">{r.source}</Td>
                  <Td className="text-xs">{timeAgo(r.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : !loading ? <Empty>No subscribers yet.</Empty> : null}
        <div className="px-4 pb-4"><Pager data={data} page={page} setPage={setPage} /></div>
      </Card>
    </div>
  );
}
