"use client";
// /teams: shared buyer accounts — invite colleagues by email, see team orders.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { base } from "@/lib/constant";

const input = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";
const token = () => { const t = Cookies.get("accessToken"); try { return t ? JSON.parse(t) : ""; } catch { return t || ""; } };
async function api(path, method = "GET", body) {
  const r = await fetch(`${base}/v1${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token()}` }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || "Something went wrong");
  return j?.data?.attributes;
}

export default function Teams() {
  const [data, setData] = useState({ teams: [], invites: [] });
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const load = () => api("/teams").then((d) => d && setData(d)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const act = (p, m, b) => api(p, m, b).then(() => { load(); }).catch((e) => toast.error(e.message));
  return (
    <div className="container py-12 space-y-8">
      <h1 className="text-3xl font-semibold">Teams</h1>
      <form className="flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); act("/teams", "POST", { name }); setName(""); }}>
        <input className={input} placeholder="New team name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="px-4 rounded-lg bg-emerald-600 text-white">Create</button>
      </form>
      {data.invites?.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Invitations</h2>
        {data.invites.map((i) => <div key={i.id} className="flex gap-3 items-center border rounded-lg p-3"><span className="flex-1">{i.name}</span>
          <button className="text-emerald-700" onClick={() => act(`/teams/${i.id}/accept`, "POST")}>Accept</button>
          <button className="text-gray-500" onClick={() => act(`/teams/${i.id}/decline`, "POST")}>Decline</button></div>)}</section>}
      {data.teams?.map((t) => <Team key={t.id || t._id} t={t} act={act} open={open} setOpen={setOpen} />)}
    </div>
  );
}

function Team({ t, act, open, setOpen }) {
  const id = t.id || t._id;
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState(null);
  useEffect(() => { if (open === id) api(`/teams/${id}/orders`).then(setOrders).catch((e) => toast.error(e.message)); }, [open, id]);
  return (
    <section className="border rounded-xl p-5 space-y-3">
      <div className="flex items-center"><h2 className="flex-1 font-semibold">{t.name}</h2>
        <button className="text-sm text-emerald-700" onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Hide orders" : "Team orders"}</button></div>
      <ul className="text-sm divide-y">{t.members?.map((m) => <li key={m.id || m._id} className="py-2 flex gap-3"><span className="flex-1">{m.email || m.userId?.fullName}</span><span className="text-gray-500">{m.role} · {m.status}</span>
        {m.role !== "owner" && <button className="text-red-600" onClick={() => act(`/teams/${id}/members/${m.id || m._id}`, "DELETE")}>Remove</button>}</li>)}</ul>
      <form className="flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); act(`/teams/${id}/invite`, "POST", { email }); setEmail(""); }}>
        <input className={input} type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="px-4 rounded-lg border">Invite</button>
      </form>
      {open === id && orders && <div className="text-sm"><div className="text-gray-600 mb-2">{orders.results?.length || 0} orders</div>
        <ul className="divide-y">{orders.results?.map((o) => <li key={o.id || o._id} className="py-1 flex gap-3"><span className="flex-1">{o.gigId?.title || o.title || (o.id || o._id)}</span><span>{o.status}</span></li>)}</ul></div>}
    </section>
  );
}
