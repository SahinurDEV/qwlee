"use client";
// /talent: search sellers and invite them to one of your open buyer requests;
// sellers see requests they were invited to (offers on those cost no credits).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import useUser from "@/hooks/useUser";
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


export default function Talent() {
  const user = useUser();
  const [q, setQ] = useState("");
  const [pro, setPro] = useState(false);
  const [res, setRes] = useState({ results: [] });
  const [requests, setRequests] = useState([]);
  const [invites, setInvites] = useState([]);
  const search = () => api(`/talent?q=${encodeURIComponent(q)}${pro ? "&pro=true" : ""}`).then((d) => d && setRes(d)).catch((e) => toast.error(e.message));
  useEffect(() => { search(); }, [pro]);
  useEffect(() => {
    if (!user) return;
    api("/requests/mine?limit=50").then((d) => setRequests((d?.results || []).filter((r) => r.status === "open"))).catch(() => {});
    if (user.role === "freelancer") api("/requests/invites/mine").then((d) => setInvites(d || [])).catch(() => {});
  }, [user?.role]);
  const invite = (rid, sellerId) => api(`/requests/${rid}/invite`, "POST", { sellerId }).then(() => toast.success("Invitation sent")).catch((e) => toast.error(e.message));
  return (
    <div className="container py-12 space-y-8">
      <h1 className="text-3xl font-semibold">Find talent</h1>
      {invites.length > 0 && <section className="border rounded-xl p-5"><h2 className="font-semibold mb-2">You were invited to</h2>
        <ul className="space-y-1">{invites.map((r) => <li key={r.id || r._id}><Link className="text-emerald-700" href={`/requests/${r.id || r._id}`}>{r.title}</Link> <span className="text-sm text-gray-500">· offers on invites are free</span></li>)}</ul></section>}
      <form className="flex gap-2 items-center max-w-xl" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input className={input} placeholder="Name, skill or keyword" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1 text-sm whitespace-nowrap"><input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} /> Pro only</label>
        <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Search</button>
      </form>
      <div className="text-sm text-gray-500">{res.total ?? 0} sellers</div>
      <div className="grid md:grid-cols-2 gap-4">
        {res.results.map((u) => <div key={u.id || u._id} className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2"><Link href={`/${u.username}`} className="font-medium">{u.fullName}</Link>
            {u.isPro && <span className="text-xs px-2 rounded bg-gray-900 text-white">Pro</span>}{u.online && <span className="text-xs text-emerald-600">online</span>}</div>
          {u.intro && <p className="text-sm text-gray-600">{u.intro}</p>}
          {u.skills?.length > 0 && <div className="text-xs text-gray-500">{u.skills.slice(0, 6).map((s) => (typeof s === "string" ? s : s?.name)).join(" · ")}</div>}
          {requests.length > 0 && <select className={input} defaultValue="" onChange={(e) => { if (e.target.value) invite(e.target.value, u.id || u._id); e.target.value = ""; }}>
            <option value="">Invite to a request…</option>{requests.map((r) => <option key={r.id || r._id} value={r.id || r._id}>{r.title}</option>)}</select>}
        </div>)}
      </div>
    </div>
  );
}
