"use client";
// /teams: shared buyer accounts — invite colleagues by email, see team orders.
// Auth via HttpOnly session cookies (credentials:include).
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { base } from "@/lib/constant";

const input = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";

async function api(path, method = "GET", body) {
  const r = await fetch(`${base}/v1${path}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || "Something went wrong");
  return j?.data?.attributes;
}

const ROLE = {
  owner: "bg-gray-900 text-white",
  admin: "bg-amber-100 text-amber-900",
  member: "bg-emerald-50 text-emerald-800",
};

export default function Teams() {
  const [data, setData] = useState({ teams: [], invites: [] });
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () =>
    api("/teams")
      .then((d) => d && setData(d))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  const act = (p, m, b) =>
    api(p, m, b)
      .then(() => {
        load();
      })
      .catch((e) => toast.error(e.message));

  return (
    <div className="container py-12 space-y-8" data-testid="teams-page">
      <header>
        <h1 className="text-3xl font-semibold">Teams</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Shared buyer workspaces for companies. Invite colleagues by email, manage roles, and review everyone&rsquo;s orders in one place.
        </p>
      </header>

      <form
        className="flex flex-wrap gap-2 max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          act("/teams", "POST", { name });
          setName("");
        }}
      >
        <input
          className={`${input} flex-1 min-w-[200px]`}
          placeholder="New team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
        <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">Create team</button>
      </form>

      {data.invites?.length > 0 && (
        <section className="space-y-2" data-testid="team-invites">
          <h2 className="font-semibold">Invitations</h2>
          {data.invites.map((i) => (
            <div key={i.id} className="flex flex-wrap gap-3 items-center border border-amber-200 bg-amber-50 rounded-xl p-3">
              <span className="flex-1 font-medium text-gray-900">{i.name}</span>
              <button className="text-sm font-medium text-emerald-700 hover:underline" onClick={() => act(`/teams/${i.id}/accept`, "POST")}>
                Accept
              </button>
              <button className="text-sm text-gray-500 hover:underline" onClick={() => act(`/teams/${i.id}/decline`, "POST")}>
                Decline
              </button>
            </div>
          ))}
        </section>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading teams…</p>
      ) : !data.teams?.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600" data-testid="teams-empty">
          <p className="font-medium text-gray-900">No teams yet</p>
          <p className="mt-1">Create a team above, or wait for an invite to your email.</p>
        </div>
      ) : (
        data.teams.map((t) => <Team key={t.id || t._id} t={t} act={act} open={open} setOpen={setOpen} />)
      )}
    </div>
  );
}

function Team({ t, act, open, setOpen }) {
  const id = t.id || t._id;
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (open === id) {
      api(`/teams/${id}/orders`)
        .then(setOrders)
        .catch((e) => toast.error(e.message));
    }
  }, [open, id]);

  return (
    <section className="border border-gray-200 rounded-2xl p-5 space-y-4 bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold text-gray-900">{t.name}</h2>
        {t.myRole ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE[t.myRole] || ROLE.member}`}>
            {t.myRole}
          </span>
        ) : null}
        <button
          type="button"
          className="text-sm font-medium text-emerald-700 hover:underline"
          onClick={() => setOpen(open === id ? null : id)}
        >
          {open === id ? "Hide orders" : "Team orders"}
        </button>
      </div>

      <ul className="text-sm divide-y divide-gray-100 rounded-xl border border-gray-100">
        {t.members?.map((m) => (
          <li key={m.id || m._id} className="py-2.5 px-3 flex flex-wrap gap-2 items-center">
            <span className="flex-1 min-w-[140px] text-gray-900">
              {m.userId?.fullName || m.email}
              {m.userId?.username ? (
                <span className="text-gray-400"> · @{m.userId.username}</span>
              ) : null}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ROLE[m.role] || ROLE.member}`}>{m.role}</span>
            <span className="text-xs text-gray-500 capitalize">{m.status}</span>
            {m.role !== "owner" && (t.myRole === "owner" || t.myRole === "admin") && (
              <button
                type="button"
                className="text-xs text-rose-700 hover:underline"
                onClick={() => act(`/teams/${id}/members/${m.id || m._id}`, "DELETE")}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {(t.myRole === "owner" || t.myRole === "admin") && (
        <form
          className="flex flex-wrap gap-2 max-w-xl items-center"
          onSubmit={(e) => {
            e.preventDefault();
            act(`/teams/${id}/invite`, "POST", { email, role: inviteRole });
            setEmail("");
          }}
        >
          <input
            className={`${input} flex-1 min-w-[180px]`}
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select className={`${input} w-auto`} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Invite role">
            <option value="member">Member</option>
            {t.myRole === "owner" && <option value="admin">Admin</option>}
          </select>
          <button type="submit" className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Invite
          </button>
        </form>
      )}

      {open === id && orders && (
        <div className="text-sm border-t border-gray-100 pt-3" data-testid="team-orders">
          <div className="text-gray-600 mb-2 font-medium">{orders.results?.length || 0} team orders</div>
          {!orders.results?.length ? (
            <p className="text-gray-500">No shared orders yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.results.map((o) => {
                const oid = o.id || o._id;
                return (
                  <li key={oid} className="py-2 flex flex-wrap gap-2 items-center">
                    <Link href={`/order/${oid}`} className="flex-1 text-emerald-700 hover:underline min-w-[160px]">
                      {o.gigId?.title || o.title || oid}
                    </Link>
                    <span className="text-xs capitalize text-gray-500">{o.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
