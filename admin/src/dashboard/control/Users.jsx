// /dashboard/users — search every account and manage it: edit profile,
// verify email, ban/unban, password reset, sign out everywhere, change
// role (super admins), and a read-only "view as user".
import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "antd";
import toast from "react-hot-toast";
import { IoSearch, IoEyeOutline, IoCreateOutline } from "react-icons/io5";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { adminFetch, qs, useAdminQuery } from "../../utils/adminApi";
import { formatDate, formatMoney } from "../../utils/format";
import { act, ErrorNote, Field, input, Pager, select, Tabs, Td, Th, Empty, promptBan } from "./ui";
import { confirmModal } from "../../common/confirm";

const ROLES = [
  { v: "", label: "All" },
  { v: "buyer", label: "Buyers" },
  { v: "freelancer", label: "Sellers" },
  { v: "admin", label: "Admins" },
];

export default function Users() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = useAdminQuery(`/admin/users${qs({ search: term, role, status, page, limit: 15 })}`);
  const me = useAdminQuery("/admin/me");
  const isSuper = me.data?.adminRole === "super";
  const [picked, setPicked] = useState(() => new Set());
  const pageIds = (data?.results || []).filter((u) => u.role !== "admin").map((u) => u.id);
  const allPicked = pageIds.length > 0 && pageIds.every((id) => picked.has(id));
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (action) => {
    const ids = [...picked];
    let extra = {};
    if (action === "ban") {
      const r = await promptBan({ title: `Ban ${ids.length} users`, count: ids.length });
      if (!r) return;
      extra = r;
    } else if (!(await confirmModal({ title: action === "unban" ? `Unban ${ids.length} users?` : `Sign ${ids.length} users out everywhere?`, confirmText: "Confirm" }))) return;
    try {
      const r = await adminFetch("/admin/bulk/users", { method: "POST", body: { ids, action, ...extra } });
      if (r.failed) toast(`${r.done} done, ${r.failed} skipped: ${r.results.filter((x) => !x.ok).map((x) => x.error).slice(0, 2).join("; ")}`);
      else toast.success(`${r.done} done`);
      setPicked(new Set());
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Find any account and manage it. Every action is permission-checked and recorded in the audit log." />
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <Tabs tabs={ROLES} value={role} onChange={(v) => { setRole(v); setPage(1); }} />
          <div className="flex gap-2">
            <select className={select + " w-40"} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Any status</option>
              <option value="banned">Banned</option>
              <option value="unverified">Email unverified</option>
            </select>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(search); setPage(1); }} className="relative">
              <IoSearch className="absolute left-3 top-2.5 text-ink-400" />
              <input className={input + " pl-9 w-64"} placeholder="Name, email or username" value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
          </div>
        </div>
        <ErrorNote error={error} />
        {picked.size ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 text-sm" data-testid="bulk-bar">
            <span className="font-medium">{picked.size} selected</span>
            <Button size="sm" variant="danger" onClick={() => bulk("ban")}>Ban…</Button>
            <Button size="sm" variant="secondary" onClick={() => bulk("unban")}>Unban</Button>
            <Button size="sm" variant="secondary" onClick={() => bulk("logout")}>Sign out everywhere</Button>
            <button type="button" className="ml-auto text-xs text-ink-500 underline" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        ) : null}
        {loading && !data ? <Empty>Loading…</Empty> : null}
        {data?.results?.length === 0 ? <Empty>No users match.</Empty> : null}
        {data?.results?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="users-table">
              <thead className="border-b border-ink-100">
                <tr><Th><input type="checkbox" aria-label="Select page" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); pageIds.forEach((id) => (allPicked ? n.delete(id) : n.add(id))); return n; })} /></Th><Th>User</Th><Th>Role</Th><Th>Status</Th><Th>Balance</Th><Th>Joined</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.results.map((u) => (
                  <tr key={u.id}>
                    <Td>{u.role === "admin" ? null : <input type="checkbox" aria-label={`Select ${u.email}`} checked={picked.has(u.id)} onChange={() => toggle(u.id)} />}</Td>
                    <Td>
                      <div className="font-medium text-ink-900">{u.fullName || u.username}</div>
                      <div className="text-xs text-ink-500">{u.email}</div>
                    </Td>
                    <Td>
                      <span className="capitalize">{u.role === "freelancer" ? "seller" : u.role}</span>
                      {u.role === "admin" ? <span className="ml-1 text-xs text-ink-500">({u.adminRole || "super"})</span> : null}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {u.isBan ? <StatusPill status="error" label={u.bannedUntil ? `Banned until ${formatDate(u.bannedUntil)}` : "Banned"} /> : <StatusPill status="ok" label="Active" />}
                        {u.isEmailVerified ? null : <StatusPill status="warning" label="Unverified" />}
                      </div>
                    </Td>
                    <Td>{formatMoney(u.balance || 0, { maxFractionDigits: 2 })}</Td>
                    <Td>{formatDate(u.createdAt)}</Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button as={Link} to={`/dashboard/users/${u.id}/view`} size="sm" variant="secondary" iconLeft={IoEyeOutline}>View as</Button>
                        <Button size="sm" variant="secondary" iconLeft={IoCreateOutline} onClick={() => setEditing(u)}>Manage</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Pager data={data} page={page} setPage={setPage} />
      </Card>
      {editing ? <ManageUser user={editing} isSuper={isSuper} onClose={() => setEditing(null)} onChanged={() => { reload(); }} /> : null}
    </div>
  );
}

function ManageUser({ user, isSuper, onClose, onChanged }) {
  const [form, setForm] = useState({ fullName: user.fullName || "", username: user.username || "", email: user.email || "", isEmailVerified: !!user.isEmailVerified });
  const [role, setRole] = useState(user.role);
  const [adminRole, setAdminRole] = useState(user.adminRole || "super");
  const roleList = useAdminQuery(isSuper ? "/admin/roles" : null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await adminFetch(`/admin/users/${user.id}`, { method: "PATCH", body: form });
      toast.success("Profile saved");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const done = () => { onChanged(); onClose(); };
  return (
    <Modal open onCancel={onClose} footer={null} title={`Manage ${user.fullName || user.email}`} width={640} centered>
      <div className="space-y-5" data-testid="manage-user">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name"><input className={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Username"><input className={input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label="Email"><input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={form.isEmailVerified} onChange={(e) => setForm({ ...form, isEmailVerified: e.target.checked })} /> Email verified
          </label>
          <div className="sm:col-span-2"><Button loading={saving} onClick={save}>Save profile</Button></div>
        </section>
        <section className="border-t border-ink-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Account actions</h3>
          <div className="flex flex-wrap gap-2">
            {user.isBan ? (
              <Button size="sm" variant="secondary" onClick={() => act({ title: "Unban this user?", path: `/admin/users/${user.id}/unban`, method: "PATCH", done, success: "User unbanned" })}>Unban</Button>
            ) : (
              <Button size="sm" variant="danger" onClick={async () => {
                const r = await promptBan({ title: "Ban this user" });
                if (!r) return;
                try {
                  await adminFetch(`/admin/users/${user.id}/ban`, { method: "PATCH", body: r });
                  toast.success(r.days ? `Banned for ${r.days} days` : "User banned");
                  done();
                } catch (e) {
                  toast.error(e.message);
                }
              }}>Ban</Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => act({ title: "Send a password reset email?", description: "They receive a one-time code to choose a new password.", path: `/admin/users/${user.id}/reset-password`, done, success: "Reset email sent" })}>Send password reset</Button>
            <Button size="sm" variant="secondary" onClick={() => act({ title: "Sign this user out everywhere?", description: "All their current sessions end immediately.", path: `/admin/users/${user.id}/logout-all`, done, success: "Signed out everywhere" })}>Sign out everywhere</Button>
          </div>
        </section>
        {user.role !== "admin" ? <UserWarnings userId={user.id} /> : null}
        <UserSessions userId={user.id} />
        {isSuper && user.role !== "admin" ? (
          <section className="border-t border-ink-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Personal data (GDPR)</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  const data = await adminFetch(`/admin/privacy/${user.id}/export`);
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
                  a.download = `user-${user.id}-data.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch (e) { toast.error(e.message); }
              }}>Export data</Button>
              <Button size="sm" variant="danger" onClick={() => act({ title: "Erase this account?", description: "Anonymises the profile, pauses their gigs, deletes personal-only data and signs them out. Orders, payments and reviews stay. Can't be undone. Blocked while they have open orders, pending withdrawals or a balance.", danger: true, path: `/admin/privacy/${user.id}/erase`, body: { confirm: "ERASE" }, done, success: "Account erased" })}>Erase account</Button>
            </div>
          </section>
        ) : null}
        <section className="border-t border-ink-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Role {isSuper ? "" : "(super admins only)"}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Account type">
              <select disabled={!isSuper} className={select + " w-40"} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="freelancer">Seller</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            {role === "admin" ? (
              <Field label="Admin role">
                <select disabled={!isSuper} className={select + " w-40"} value={adminRole} onChange={(e) => setAdminRole(e.target.value)}>
                  {["super", "moderator", "support", "finance"].map((r) => <option key={r} value={r}>{r}</option>)}
                  {(roleList.data?.custom || []).map((r) => <option key={r.key} value={r.key}>{r.name} (custom)</option>)}
                </select>
              </Field>
            ) : null}
            <Button size="md" variant="secondary" disabled={!isSuper} onClick={() => act({ title: "Change role?", description: "The user is signed out and gets the new access on next sign-in.", path: `/admin/users/${user.id}/role`, method: "PATCH", body: { role, ...(role === "admin" ? { adminRole } : {}) }, done, success: "Role updated" })}>Apply role</Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

// Signed-in devices; each can be signed out on its own.
function UserSessions({ userId }) {
  const { data, reload } = useAdminQuery(`/admin/users/${userId}/sessions`);
  const rows = data?.results || [];
  const revoke = async (sid) => {
    try {
      await adminFetch(`/admin/users/${userId}/sessions/${sid}`, { method: "DELETE" });
      toast.success("Session signed out");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <section className="border-t border-ink-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Signed-in devices ({rows.length})</h3>
      {rows.length ? (
        <ul className="divide-y divide-ink-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-ink-800" title={r.userAgent}>{r.userAgent || "Unknown device"}</p>
                <p className="text-xs text-ink-500">{r.ip || "?"} · signed in {formatDate(r.createdAt)} · last seen {formatDate(r.lastSeenAt)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => revoke(r.id)}>Sign out</Button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-500">No active sessions.</p>}
    </section>
  );
}

// Trust & safety: warnings (with expiry) and restriction for one user.
function UserWarnings({ userId }) {
  const { data, reload } = useAdminQuery(`/admin/users/${userId}/warnings`);
  const [reason, setReason] = useState("off_platform");
  const [note, setNote] = useState("");
  const rows = data?.results || [];
  const run = async (path, method, body, msg) => {
    try {
      const r = await adminFetch(path, { method, body });
      toast.success(r?.escalation ? `${msg} — account ${r.escalation}` : msg);
      setNote("");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <section className="border-t border-ink-100 pt-4" data-testid="user-warnings">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Warnings ({rows.filter((w) => w.active).length} active)</h3>
      {data?.restriction ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex flex-wrap items-center justify-between gap-2">
          <span>Restricted until {formatDate(data.restriction.until)}: {data.restriction.reason}</span>
          <Button size="sm" variant="secondary" onClick={() => act({ title: "Lift the restriction?", description: "Paused gigs go live again.", path: `/admin/users/${userId}/restrict`, method: "DELETE", done: reload, success: "Restriction lifted" })}>Lift</Button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select aria-label="Warning reason" className={select} value={reason} onChange={(e) => setReason(e.target.value)}>
          {(data?.reasons || []).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input aria-label="Warning note" className={input + " sm:col-span-2"} placeholder="Note shown to the user (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => run(`/admin/users/${userId}/warnings`, "POST", { reason, note }, "Warning issued")}>Issue warning</Button>
        {!data?.restriction ? <Button size="sm" variant="danger" onClick={() => act({ title: "Restrict this account?", description: "They can finish current orders and withdraw, but can't publish gigs, send offers, start conversations or get new orders. Their gigs are paused. At the end of the period the account is suspended.", askReason: "Reason shown to the user", path: `/admin/users/${userId}/restrict`, done: reload, success: "Account restricted" })}>Restrict</Button> : null}
      </div>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-ink-100 text-sm">
          {rows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className={w.active ? "text-ink-800" : "text-ink-400 line-through"}>{w.label}{w.note ? ` — ${w.note}` : ""}</p>
                <p className="text-xs text-ink-500">{formatDate(w.createdAt)} · {w.revokedAt ? "revoked" : w.active ? `expires ${formatDate(w.expiresAt)}` : "expired"}{w.escalation ? ` · led to ${w.escalation}` : ""}{w.issuedBy?.fullName ? ` · by ${w.issuedBy.fullName}` : ""}</p>
              </div>
              {w.active ? <Button size="sm" variant="secondary" onClick={() => run(`/admin/warnings/${w.id}`, "DELETE", undefined, "Warning revoked")}>Revoke</Button> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
