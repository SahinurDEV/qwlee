"use client";
// Calls inside an order: propose time slots, the other side picks one and
// both get a meeting link.
import { useEffect, useState } from "react";
import { toast } from "sonner";
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


const fmt = (d) => new Date(d).toLocaleString();

export default function CallsCard({ orderId }) {
  const user = useUser();
  const me = user?.id || user?._id;
  const [calls, setCalls] = useState([]);
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState([]);
  const [topic, setTopic] = useState("");
  const load = () => api(`/orders/${orderId}/calls`).then((d) => setCalls(d || [])).catch(() => {});
  useEffect(() => { if (orderId) load(); }, [orderId]);
  const act = (p, b) => api(p, "POST", b).then(() => { load(); }).catch((e) => toast.error(e.message));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold">Calls</h3>
      {calls.map((c) => {
        const mine = String(c.proposedBy) === String(me);
        return <div key={c.id} className="text-sm border rounded-lg p-3 space-y-1">
          <div className="flex"><span className="flex-1 font-medium">{c.topic || "Call"} · {c.durationMin} min</span><span className="text-gray-500">{c.status}</span></div>
          {c.status === "scheduled" && <div>{fmt(c.startsAt)} — <a className="text-emerald-700 underline" href={c.meetingUrl} target="_blank" rel="noreferrer">Join</a></div>}
          {c.status === "proposed" && (mine ? <div className="text-gray-500">Waiting for the other side: {c.slots.map(fmt).join(", ")}</div> :
            <div className="flex flex-wrap gap-2">{c.slots.map((s) => <button key={s} className="px-2 py-1 rounded bg-emerald-50 text-emerald-800" onClick={() => act(`/orders/${orderId}/calls/${c.id}/accept`, { slot: s })}>{fmt(s)}</button>)}
              <button className="text-gray-500" onClick={() => act(`/orders/${orderId}/calls/${c.id}/decline`)}>Decline</button></div>)}
          {["proposed", "scheduled"].includes(c.status) && mine && <button className="text-red-600" onClick={() => act(`/orders/${orderId}/calls/${c.id}/cancel`)}>Cancel</button>}
        </div>;
      })}
      <div className="space-y-2">
        <input className={input} placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <div className="flex gap-2"><input className={`${input} min-w-0 flex-1`} type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} />
          <button className="shrink-0 px-3 rounded-lg border" onClick={() => { if (slot && slots.length < 5) { setSlots([...slots, new Date(slot).toISOString()]); setSlot(""); } }}>Add</button></div>
        {slots.length > 0 && <div className="text-xs text-gray-600">{slots.map(fmt).join(" · ")}</div>}
        <button className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50" disabled={!slots.length}
          onClick={() => act(`/orders/${orderId}/calls`, { slots, topic, durationMin: 30 }).then(() => { setSlots([]); setTopic(""); })}>Propose call</button>
      </div>
    </div>
  );
}
