// /dashboard/team — admin accounts, their sub-roles and what each role
// may do. Role changes are made from Users → Manage (super only).
import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../../common/Button";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import StatusPill from "../../common/StatusPill";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { timeAgo } from "../../utils/format";
import { ErrorNote, Field, input, Td, Th, act } from "./ui";

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
  const { data, error, reload } = useAdminQuery("/admin/team");
  const roles = data?.roles || {};
  const has = (r, p) => (roles[r] || []).includes("*") || (roles[r] || []).includes(p);
  return (
    <div>
      <PageHeader title="Admin team & permissions" subtitle="Every admin action is checked against the admin's role and recorded in the audit log." />
      <ErrorNote error={error} />
      {data ? (
        <div className="space-y-5">
          <Card title="Admins" bodyClassName="p-0">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="border-b border-ink-100"><tr><Th>Admin</Th><Th>Role</Th><Th>Status</Th><Th>Two-factor</Th><Th>Last seen</Th><Th /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.admins.map((a) => (
                  <tr key={a.id}>
                    <Td><div className="font-medium">{a.fullName}</div><div className="text-xs text-ink-500">{a.email}</div></Td>
                    <Td className="capitalize">{a.adminRole}{a.id === data.me.id ? <span className="ml-1 text-xs text-ink-500">(you)</span> : null}</Td>
                    <Td>{a.isBan ? <StatusPill status="error" label="Banned" /> : <StatusPill status="ok" label="Active" />}</Td>
                    <Td>{a.twoFactorEnabled ? <StatusPill status="ok" label="On" /> : <StatusPill status="pending" label="Off" />}</Td>
                    <Td className="text-xs">{a.lastSeen ? timeAgo(a.lastSeen) : "—"}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {a.twoFactorEnabled && a.id !== data.me.id ? (
                        <button className="text-xs text-rose-700 mr-3" onClick={() => act({ title: `Reset two-factor for ${a.fullName}?`, description: "Use when they lost their device. They are signed out and must set it up again.", danger: true, path: `/admin/team/${a.id}/reset-2fa`, done: reload, success: "Two-factor reset" })}>Reset 2FA</button>
                      ) : null}
                      <Link className="text-xs text-primary-700" to={`/dashboard/audit?admin=${a.id}`}>Activity</Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <Card title="Recent admin sign-ins" bodyClassName="p-0">
            {data.logins?.length ? (
              <div className="overflow-x-auto"><table className="w-full">
                <thead className="border-b border-ink-100"><tr><Th>Admin</Th><Th>IP</Th><Th>Device</Th><Th>When</Th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {data.logins.map((l) => (
                    <tr key={l.id}><Td>{l.admin}</Td><Td className="font-mono text-xs">{l.ip || "—"}</Td><Td className="text-xs text-ink-500 max-w-xs truncate" title={l.userAgent}>{l.userAgent || "—"}</Td><Td className="text-xs">{timeAgo(l.at)}</Td></tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p className="p-4 text-sm text-ink-500">No sign-ins recorded yet.</p>}
            <p className="px-4 pb-4 text-xs text-ink-500">Something unfamiliar? Use Users → Manage → “Sign out everywhere” on that admin and reset their password.</p>
          </Card>
          <CustomRoles onChange={reload} />
          <Card title="Role permissions" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <div className="overflow-x-auto"><table className="w-full" data-testid="perm-matrix">
                <thead className="border-b border-ink-100"><tr><Th>Permission</Th>{Object.keys(roles).map((r) => <Th key={r} className="text-center capitalize">{r}</Th>)}</tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {PERMS.map(([p, label]) => (
                    <tr key={p}>
                      <Td><div className="text-sm">{label}</div><code className="text-xs text-ink-500">{p}</code></Td>
                      {Object.keys(roles).map((r) => <Td key={r} className="text-center">{has(r, p) ? <span className="text-primary-600 font-bold">✓</span> : <span className="text-ink-300">—</span>}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// Custom roles: any mix of the permissions above (never full access).
function CustomRoles({ onChange }) {
  const { data, reload } = useAdminQuery("/admin/roles");
  const [form, setForm] = useState(null); // {id?, name, description, permissions:Set}
  const [saving, setSaving] = useState(false);
  const refresh = () => { reload(); onChange?.(); };
  const save = async () => {
    setSaving(true);
    try {
      const body = { name: form.name, description: form.description, permissions: [...form.permissions] };
      if (form.id) await adminFetch(`/admin/roles/${form.id}`, { method: "PATCH", body });
      else await adminFetch("/admin/roles", { method: "POST", body });
      toast.success(form.id ? "Role saved; its admins sign in again" : "Role created");
      setForm(null);
      refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Custom roles" subtitle="Give an admin only the access they need. Assign roles from Users → Manage." actions={!form ? <Button size="sm" onClick={() => setForm({ name: "", description: "", permissions: new Set(["read"]) })}>New role</Button> : null}>
      {form ? (
        <div className="space-y-3 mb-4 border border-ink-100 rounded-xl p-4" data-testid="role-form">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name"><input aria-label="Role name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description"><input aria-label="Role description" className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-1">
            {PERMS.map(([p, label]) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label={`Permission ${p}`} disabled={p === "read"} checked={form.permissions.has(p)} onChange={() => { const n = new Set(form.permissions); n.has(p) ? n.delete(p) : n.add(p); setForm({ ...form, permissions: n }); }} />
                {label} <code className="text-xs text-ink-500">{p}</code>
              </label>
            ))}
          </div>
          <div className="flex gap-2"><Button loading={saving} onClick={save}>{form.id ? "Save role" : "Create role"}</Button><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button></div>
        </div>
      ) : null}
      {data?.custom?.length ? (
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="border-b border-ink-100"><tr><Th>Role</Th><Th>Permissions</Th><Th>Admins</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.custom.map((r) => (
              <tr key={r.id}>
                <Td><div className="font-medium">{r.name}</div><code className="text-xs text-ink-500">{r.key}</code>{r.description ? <div className="text-xs text-ink-500">{r.description}</div> : null}</Td>
                <Td className="text-xs">{r.permissions.join(", ")}</Td>
                <Td>{r.admins}</Td>
                <Td className="text-right whitespace-nowrap">
                  <button className="text-xs text-primary-700 mr-3" onClick={() => setForm({ id: r.id, name: r.name, description: r.description || "", permissions: new Set(r.permissions) })}>Edit</button>
                  <button className="text-xs text-rose-700" onClick={() => act({ title: `Delete the ${r.name} role?`, danger: true, method: "DELETE", path: `/admin/roles/${r.id}`, done: refresh, success: "Role deleted" })}>Delete</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : !form ? <p className="text-sm text-ink-500">No custom roles yet. The built-in roles are super, moderator, support and finance.</p> : null}
    </Card>
  );
}
