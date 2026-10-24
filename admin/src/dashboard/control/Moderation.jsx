// /dashboard/moderation — buyer requests, seller offers and reviews.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { qs, useAdminQuery } from "../../utils/adminApi";
import { formatDate, formatMoney, truncate } from "../../utils/format";
import { act, Empty, ErrorNote, Pager, Tabs, Td, Th } from "./ui";

const SECTIONS = [
  { v: "requests", label: "Buyer requests" },
  { v: "offers", label: "Offers" },
  { v: "reviews", label: "Reviews" },
];

export default function Moderation() {
  const [section, setSection] = useState("requests");
  return (
    <div>
      <PageHeader title="Moderation" subtitle="Close or remove buyer requests and offers, and take down abusive reviews." />
      <div className="mb-4"><Tabs tabs={SECTIONS} value={section} onChange={setSection} /></div>
      {section === "requests" ? <Requests /> : section === "offers" ? <Offers /> : <Reviews />}
    </div>
  );
}

function Requests() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdminQuery(`/admin/requests${qs({ status, page, limit: 15 })}`);
  return (
    <Card>
      <div className="mb-3"><Tabs tabs={[{ v: "", label: "All" }, { v: "open", label: "Open" }, { v: "closed", label: "Closed" }, { v: "hired", label: "Hired" }]} value={status} onChange={(v) => { setStatus(v); setPage(1); }} /></div>
      <ErrorNote error={error} />
      {data?.results?.length === 0 ? <Empty /> : null}
      {data?.results?.length ? (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="border-b border-ink-100"><tr><Th>Request</Th><Th>Buyer</Th><Th>Budget</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.results.map((r) => (
              <tr key={r.id}>
                <Td><div className="font-medium">{r.title}</div><div className="text-xs text-ink-500">{truncate(r.description || "", 90)}</div></Td>
                <Td className="text-xs">{r.buyerId?.fullName}<div className="text-ink-500">{r.buyerId?.email}</div></Td>
                <Td>{formatMoney(r.budget || 0)}</Td>
                <Td><StatusPill status={r.status === "open" ? "ok" : "muted"} label={r.status} /></Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.status === "open" ? (
                      <Button size="sm" variant="secondary" onClick={() => act({ title: "Close this request?", path: `/admin/requests/${r.id}`, method: "PATCH", body: { status: "closed" }, done: reload, success: "Closed" })}>Close</Button>
                    ) : r.status === "closed" ? (
                      <Button size="sm" variant="secondary" onClick={() => act({ title: "Reopen this request?", path: `/admin/requests/${r.id}`, method: "PATCH", body: { status: "open" }, done: reload, success: "Reopened" })}>Reopen</Button>
                    ) : null}
                    {r.status !== "hired" ? <Button size="sm" variant="danger" onClick={() => act({ title: "Delete this request and its offers?", danger: true, path: `/admin/requests/${r.id}`, method: "DELETE", done: reload, success: "Deleted" })}>Delete</Button> : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : null}
      <Pager data={data} page={page} setPage={setPage} />
    </Card>
  );
}

function Offers() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdminQuery(`/admin/offers${qs({ page, limit: 15 })}`);
  return (
    <Card>
      <ErrorNote error={error} />
      {data?.results?.length === 0 ? <Empty /> : null}
      {data?.results?.length ? (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="border-b border-ink-100"><tr><Th>Offer</Th><Th>Seller</Th><Th>On request</Th><Th>Price</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.results.map((o) => (
              <tr key={o.id}>
                <Td className="max-w-[280px]">{truncate(o.message || o.description || "", 100)}</Td>
                <Td className="text-xs">{o.sellerId?.fullName}</Td>
                <Td className="text-xs">{o.requestId?.title || "—"}</Td>
                <Td>{formatMoney(o.price || 0)}</Td>
                <Td><StatusPill status={o.status === "accepted" ? "ok" : o.status === "pending" ? "pending" : "muted"} label={o.status} /></Td>
                <Td className="text-right">{o.status !== "accepted" ? <Button size="sm" variant="danger" onClick={() => act({ title: "Remove this offer?", danger: true, path: `/admin/offers/${o.id}`, method: "DELETE", done: reload, success: "Removed" })}>Remove</Button> : null}</Td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : null}
      <Pager data={data} page={page} setPage={setPage} />
    </Card>
  );
}

function Reviews() {
  const [maxRating, setMaxRating] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdminQuery(`/admin/reviews${qs({ maxRating, page, limit: 15 })}`);
  return (
    <Card>
      <div className="mb-3"><Tabs tabs={[{ v: "", label: "All" }, { v: "2", label: "≤ 2 stars" }, { v: "3", label: "≤ 3 stars" }]} value={maxRating} onChange={(v) => { setMaxRating(v); setPage(1); }} /></div>
      <ErrorNote error={error} />
      {data?.results?.length === 0 ? <Empty /> : null}
      {data?.results?.length ? (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="border-b border-ink-100"><tr><Th>Review</Th><Th>Rating</Th><Th>By → For</Th><Th>Gig</Th><Th>Date</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.results.map((r) => (
              <tr key={r.id}>
                <Td className="max-w-[320px]">{truncate(r.review || "", 140) || <span className="text-ink-400">No text</span>}</Td>
                <Td>{"★".repeat(Math.round(r.rating || 0))}<span className="text-ink-300">{"★".repeat(5 - Math.round(r.rating || 0))}</span>{r.privateRating ? <div className="text-xs text-sky-700" title={r.privateNote || ""}>Private: {r.privateRating}/5{r.privateNote ? ` · ${truncate(r.privateNote, 60)}` : ""}</div> : null}</Td>
                <Td className="text-xs">{r.userId?.fullName}<div className="text-ink-500">→ {r.freelancerId?.fullName}</div></Td>
                <Td className="text-xs max-w-[200px] truncate">{r.gigId?.title}</Td>
                <Td className="text-xs">{formatDate(r.createdAt)}</Td>
                <Td className="text-right"><Button size="sm" variant="danger" onClick={() => act({ title: "Remove this review?", description: "It disappears from the gig and the seller's rating.", danger: true, path: `/admin/reviews/${r.id}`, method: "DELETE", done: reload, success: "Review removed" })}>Remove</Button></Td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : null}
      <Pager data={data} page={page} setPage={setPage} />
    </Card>
  );
}
