// /dashboard/escrow — money held, released and refunded, plus every
// payment with admin refund / force-complete actions.
import { useState } from "react";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Kpi from "../../common/Kpi";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { qs, useAdminQuery } from "../../utils/adminApi";
import { formatDate, formatMoney } from "../../utils/format";
import { act, Empty, ErrorNote, Pager, Tabs, Td, Th } from "./ui";

const TABS = [
  { v: "", label: "All" },
  { v: "held", label: "Held" },
  { v: "released", label: "Released" },
  { v: "refunded", label: "Refunded" },
];
const m = (n) => formatMoney(n || 0, { maxFractionDigits: 2 });

export default function Escrow() {
  const [tab, setTab] = useState("");
  const [page, setPage] = useState(1);
  const sum = useAdminQuery("/admin/escrow");
  const { data, error, reload } = useAdminQuery(`/admin/payments${qs({ escrow: tab, page, limit: 15 })}`);
  const refresh = () => { reload(); sum.reload(); };
  const e = sum.data?.escrow || {};
  return (
    <div>
      <PageHeader title="Payments & escrow" subtitle="Buyer money is held in escrow until the order completes. Refund or release it here." />
      <ErrorNote error={sum.error || error} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Kpi label="Held in escrow" value={m(e.held?.amount)} hint={`${e.held?.count || 0} orders`} tone="amber" />
        <Kpi label="Released to sellers" value={m(e.released?.amount)} hint={`${e.released?.count || 0} orders`} />
        <Kpi label="Platform fees earned" value={m(e.released?.fees)} tone="violet" />
        <Kpi label="Refunded to buyers" value={m(e.refunded?.amount)} hint={`${e.refunded?.count || 0} orders`} tone="rose" />
        <Kpi label="Pending payouts" value={m(sum.data?.pendingWithdrawals?.amount)} hint={`${sum.data?.pendingWithdrawals?.count || 0} requests · balances ${m(sum.data?.sellerBalances)}`} tone="sky" />
      </div>
      <Card>
        <div className="mb-4"><Tabs tabs={TABS} value={tab} onChange={(v) => { setTab(v); setPage(1); }} /></div>
        {data?.results?.length === 0 ? <Empty /> : null}
        {data?.results?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="payments-table">
              <thead className="border-b border-ink-100"><tr><Th>Order</Th><Th>Buyer → Seller</Th><Th>Price</Th><Th>Status</Th><Th>Escrow</Th><Th>Fee</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.results.map((o) => {
                  const open = ["active", "late", "disputed"].includes(o.status) && !["released", "refunded"].includes(o.escrow?.status);
                  return (
                    <tr key={o.id}>
                      <Td><div className="font-medium max-w-[260px] truncate">{o.gigId?.title || "Custom order"}</div><div className="text-xs text-ink-500">{formatDate(o.createdAt)} · {o.escrow?.provider || "—"}</div></Td>
                      <Td><div className="text-xs">{o.clientId?.fullName || "—"}</div><div className="text-xs text-ink-500">→ {o.freelancerId?.fullName || "—"}</div></Td>
                      <Td>{m(o.price)}</Td>
                      <Td><StatusPill status={o.status} /></Td>
                      <Td><StatusPill status={o.escrow?.status === "released" ? "ok" : o.escrow?.status === "refunded" ? "error" : "pending"} label={o.escrow?.status || "—"} /></Td>
                      <Td>{o.platformFee != null ? m(o.platformFee) : "—"}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          {open ? <Button size="sm" variant="secondary" onClick={() => act({ title: "Force complete this order?", description: "Escrow is released to the seller minus the platform fee.", path: `/admin/orders/${o.id}/complete`, done: refresh, success: "Order completed" })}>Complete</Button> : null}
                          {o.escrow?.status !== "refunded" ? <Button size="sm" variant="danger" onClick={() => act({ title: "Refund the buyer", description: "Cancels the order and marks escrow refunded. If it was already released, the seller's credit is reversed. Card payments must also be refunded in Stripe.", askReason: "Reason (shown to both parties)", path: `/admin/orders/${o.id}/refund`, done: refresh, success: "Order refunded" })}>Refund</Button> : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <Pager data={data} page={page} setPage={setPage} />
      </Card>
    </div>
  );
}
