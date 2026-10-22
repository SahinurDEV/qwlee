// /dashboard/users/:userId/view — read-only "view as user". No session is
// created for the user and nothing here can change their data; opening it
// is recorded in the audit log.
import { Link, useParams } from "react-router-dom";
import { IoArrowBack, IoLockClosedOutline } from "react-icons/io5";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Kpi from "../../common/Kpi";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery } from "../../utils/adminApi";
import { formatDate, formatMoney } from "../../utils/format";
import { Empty, ErrorNote, Td, Th } from "./ui";

export default function UserView() {
  const { userId } = useParams();
  const { data, loading, error } = useAdminQuery(`/admin/users/${userId}/view`);
  const u = data?.user;
  return (
    <div>
      <Link to="/dashboard/users" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-3"><IoArrowBack /> Users</Link>
      <PageHeader title={u ? `Viewing as ${u.fullName || u.username}` : "View as user"} subtitle={u ? `${u.email} · ${u.role === "freelancer" ? "seller" : u.role} · joined ${formatDate(u.createdAt)}` : ""} />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <IoLockClosedOutline /> Read-only view. You are not signed in as this user, and opening this page is recorded in the audit log.
      </div>
      <ErrorNote error={error} />
      {loading ? <Empty>Loading…</Empty> : null}
      {u ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Balance" value={formatMoney(u.balance || 0, { maxFractionDigits: 2 })} />
            <Kpi label="Gigs" value={data.gigs.length} tone="sky" />
            <Kpi label="Orders as buyer" value={data.buying.length} tone="violet" />
            <Kpi label="Orders as seller" value={data.selling.length} tone="amber" />
          </div>
          <Card title="Profile">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div><dt className="text-ink-500 text-xs">Status</dt><dd>{u.isBan ? <StatusPill status="error" label="Banned" /> : <StatusPill status="ok" label="Active" />}</dd></div>
              <div><dt className="text-ink-500 text-xs">Email verified</dt><dd>{u.isEmailVerified ? "Yes" : "No"}</dd></div>
              <div><dt className="text-ink-500 text-xs">Location</dt><dd>{u.location || "—"}</dd></div>
              <div className="md:col-span-3"><dt className="text-ink-500 text-xs">Intro</dt><dd>{u.intro || "—"}</dd></div>
            </dl>
          </Card>
          <Table title="Gigs" rows={data.gigs} cols={[["Title", (g) => g.title], ["Status", (g) => <StatusPill status={g.gigStatus === "active" ? "ok" : "warning"} label={g.gigStatus} />], ["Featured", (g) => (g.featured ? "Yes" : "")], ["From", (g) => formatMoney(g.price)]]} />
          <Table title="Orders as buyer" rows={data.buying} cols={[["Gig", (o) => o.gigId?.title || "—"], ["Status", (o) => <StatusPill status={o.status} />], ["Escrow", (o) => o.escrow?.status || "—"], ["Price", (o) => formatMoney(o.price)], ["Date", (o) => formatDate(o.createdAt)]]} />
          <Table title="Orders as seller" rows={data.selling} cols={[["Gig", (o) => o.gigId?.title || "—"], ["Status", (o) => <StatusPill status={o.status} />], ["Escrow", (o) => o.escrow?.status || "—"], ["Earned", (o) => (o.sellerEarning != null ? formatMoney(o.sellerEarning, { maxFractionDigits: 2 }) : "—")], ["Date", (o) => formatDate(o.createdAt)]]} />
          <Table title="Withdrawals" rows={data.withdrawals} cols={[["Amount", (w) => formatMoney(w.withdrawalAmount)], ["Status", (w) => <StatusPill status={w.status === "Completed" ? "ok" : w.status === "Failed" ? "error" : "pending"} label={w.status} />], ["Bank", (w) => w.bankName], ["Date", (w) => formatDate(w.createdAt)]]} />
          <Table title="Recent notifications" rows={data.notifications} cols={[["Message", (n) => n.message], ["Date", (n) => formatDate(n.createdAt, { withTime: true })]]} />
        </div>
      ) : null}
    </div>
  );
}

function Table({ title, rows, cols }) {
  return (
    <Card title={title} bodyClassName="p-0">
      {rows?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-100"><tr>{cols.map(([h]) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r, i) => <tr key={r._id || i}>{cols.map(([h, f]) => <Td key={h}>{f(r)}</Td>)}</tr>)}
            </tbody>
          </table>
        </div>
      ) : <Empty>None.</Empty>}
    </Card>
  );
}
