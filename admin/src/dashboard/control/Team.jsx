// /dashboard/team — admin accounts, their sub-roles and what each role
// may do. Role changes are made from Users → Manage (super only).
import { Link } from "react-router-dom";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import StatusPill from "../../common/StatusPill";
import { useAdminQuery } from "../../utils/adminApi";
import { timeAgo } from "../../utils/format";
import { ErrorNote, Td, Th } from "./ui";

const PERMS = [
  ["read", "View dashboards and lists"],
  ["users.moderate", "Edit, ban, reset and sign out users"],
  ["gigs.write", "Approve, feature, edit and delete gigs"],
  ["orders.write", "Refund, cancel and force-complete orders"],
  ["finance", "Withdrawals, escrow and payments"],
  ["disputes", "Resolve disputes"],
  ["moderation", "Requests, offers, reviews, ID checks"],
  ["content", "Categories, blog, banners, legal pages"],
  ["support", "Tickets and read conversations"],
  ["broadcast", "Send announcements"],
  ["analytics", "Analytics"],
  ["settings", "Site settings, roles, audit log"],
];

export default function Team() {
  const { data, error } = useAdminQuery("/admin/team");
  const roles = data?.roles || {};
  const has = (r, p) => (roles[r] || []).includes("*") || (roles[r] || []).includes(p);
  return (
    <div>
      <PageHeader title="Admin team & permissions" subtitle="Every admin action is checked against the admin's role and recorded in the audit log." />
      <ErrorNote error={error} />
      {data ? (
        <div className="space-y-5">
          <Card title="Admins" bodyClassName="p-0">
            <table className="w-full">
              <thead className="border-b border-ink-100"><tr><Th>Admin</Th><Th>Role</Th><Th>Status</Th><Th>Last seen</Th><Th /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.admins.map((a) => (
                  <tr key={a.id}>
                    <Td><div className="font-medium">{a.fullName}</div><div className="text-xs text-ink-500">{a.email}</div></Td>
                    <Td className="capitalize">{a.adminRole}{a.id === data.me.id ? <span className="ml-1 text-xs text-ink-500">(you)</span> : null}</Td>
                    <Td>{a.isBan ? <StatusPill status="error" label="Banned" /> : <StatusPill status="ok" label="Active" />}</Td>
                    <Td className="text-xs">{a.lastSeen ? timeAgo(a.lastSeen) : "—"}</Td>
                    <Td className="text-right"><Link className="text-xs text-primary-700" to={`/dashboard/audit?admin=${a.id}`}>Activity</Link></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Role permissions" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="perm-matrix">
                <thead className="border-b border-ink-100"><tr><Th>Permission</Th>{Object.keys(roles).map((r) => <Th key={r} className="text-center capitalize">{r}</Th>)}</tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {PERMS.map(([p, label]) => (
                    <tr key={p}>
                      <Td><div className="text-sm">{label}</div><code className="text-[11px] text-ink-500">{p}</code></Td>
                      {Object.keys(roles).map((r) => <Td key={r} className="text-center">{has(r, p) ? <span className="text-primary-600 font-bold">✓</span> : <span className="text-ink-300">—</span>}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
