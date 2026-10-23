"use client";
// /ai-assistant: opt-in writing helpers (gig description, request brief,
// reply ideas) and seller matches for your open requests. Mock text unless
// the server has an AI provider configured.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
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


const box = "bg-white border border-gray-200 rounded-xl p-6 space-y-3";
const btn = "px-4 py-2 rounded-lg bg-emerald-600 text-white";
const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success("Copied"));

export default function AiAssistant() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api("/ai/status").then(setStatus).catch(() => setStatus({ enabled: false })); }, []);
  if (status && !status.enabled) return <div className="container py-12"><h1 className="text-3xl font-semibold">AI assistant</h1><p className="mt-3 text-gray-600">AI helpers are turned off on this site.</p></div>;
  return (
    <div className="container py-12 space-y-6">
      <h1 className="text-3xl font-semibold">AI assistant</h1>
      {status?.provider === "mock" && <p className="text-sm text-gray-500">Demo mode: suggestions come from built-in templates.</p>}
      <div className="grid md:grid-cols-2 gap-6"><GigWriter /><BriefWriter /><Replies /><Matches /></div>
    </div>
  );
}

function GigWriter() {
  const [title, setTitle] = useState(""); const [skills, setSkills] = useState(""); const [out, setOut] = useState("");
  return <form className={box} onSubmit={(e) => { e.preventDefault(); api("/ai/gig-description", "POST", { title, skills }).then((d) => setOut(d.text)).catch((er) => toast.error(er.message)); }}>
    <h2 className="font-semibold">Gig description writer</h2>
    <input className={input} placeholder="Gig title" value={title} onChange={(e) => setTitle(e.target.value)} required />
    <input className={input} placeholder="Skills (comma separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
    <button className={btn}>Write</button>
    {out && <><pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">{out}</pre><button type="button" className="text-sm text-emerald-700" onClick={() => copy(out)}>Copy</button></>}
  </form>;
}

function BriefWriter() {
  const [idea, setIdea] = useState(""); const [out, setOut] = useState(null);
  return <form className={box} onSubmit={(e) => { e.preventDefault(); api("/ai/brief", "POST", { idea }).then(setOut).catch((er) => toast.error(er.message)); }}>
    <h2 className="font-semibold">Request brief writer</h2>
    <textarea className={input} rows={3} placeholder="Describe what you need" value={idea} onChange={(e) => setIdea(e.target.value)} required />
    <button className={btn}>Write brief</button>
    {out && <><div className="font-medium">{out.title}</div><pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">{out.description}</pre><button type="button" className="text-sm text-emerald-700" onClick={() => copy(`${out.title}\n\n${out.description}`)}>Copy</button></>}
  </form>;
}

function Replies() {
  const [message, setMessage] = useState(""); const [out, setOut] = useState([]);
  return <form className={box} onSubmit={(e) => { e.preventDefault(); api("/ai/replies", "POST", { message }).then((d) => setOut(d.suggestions)).catch((er) => toast.error(er.message)); }}>
    <h2 className="font-semibold">Reply ideas</h2>
    <textarea className={input} rows={3} placeholder="Paste the message you received" value={message} onChange={(e) => setMessage(e.target.value)} required />
    <button className={btn}>Suggest replies</button>
    <ul className="space-y-2">{out.map((s) => <li key={s}><button type="button" className="text-left text-sm bg-gray-50 p-2 rounded w-full" onClick={() => copy(s)}>{s}</button></li>)}</ul>
  </form>;
}

function Matches() {
  const [requests, setRequests] = useState([]); const [rid, setRid] = useState(""); const [out, setOut] = useState(null);
  useEffect(() => { api("/requests/mine?limit=50").then((d) => setRequests((d?.results || []).filter((r) => r.status === "open"))).catch(() => {}); }, []);
  return <div className={box}>
    <h2 className="font-semibold">Seller matches for your requests</h2>
    {requests.length === 0 ? <p className="text-sm text-gray-500">Post a buyer request to get matches.</p> : <>
      <select className={input} value={rid} onChange={(e) => { setRid(e.target.value); setOut(null); if (e.target.value) api(`/ai/match/${e.target.value}`).then(setOut).catch((er) => toast.error(er.message)); }}>
        <option value="">Choose a request…</option>{requests.map((r) => <option key={r.id || r._id} value={r.id || r._id}>{r.title}</option>)}</select>
      {out && (out.results.length ? <ul className="text-sm divide-y">{out.results.map((m) => <li key={m.seller.id || m.seller._id} className="py-2 flex gap-2"><Link className="flex-1 text-emerald-700" href={`/${m.seller.username}`}>{m.seller.fullName}</Link><span className="text-gray-500">score {m.score}</span></li>)}</ul> : <p className="text-sm text-gray-500">No close matches yet — try <Link className="text-emerald-700" href="/talent">talent search</Link>.</p>)}
    </>}
  </div>;
}
