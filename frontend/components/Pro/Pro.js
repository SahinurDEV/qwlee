"use client";
// /pro: Qwlee Pro — sellers apply to be vetted; buyers ask the hiring
// concierge for a shortlist; anyone can browse Pro gigs.
import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function Pro() {
  const user = useUser();
  return (
    <div className="container py-12 space-y-10">
      <header className="rounded-2xl bg-gray-900 text-white p-10">
        <div className="text-sm uppercase tracking-widest text-emerald-300">Qwlee Pro</div>
        <h1 className="mt-2 text-4xl font-semibold">Hand-vetted talent for serious projects</h1>
        <p className="mt-3 text-gray-300 max-w-2xl">Every Pro seller is reviewed by our team for experience, portfolio and track record. Need help choosing? Our hiring concierge sends you a shortlist.</p>
        <Link href="/gig?pro=true" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-emerald-500 text-gray-900 font-medium">Browse Pro gigs</Link>
      </header>
      <div className="grid md:grid-cols-2 gap-6">
        <Concierge user={user} />
        {user?.role === "freelancer" ? <Apply /> : (
          <div className="bg-white border border-gray-200 rounded-xl p-6"><h2 className="font-semibold">Are you a seller?</h2><p className="text-sm text-gray-600 mt-1">Switch to selling to apply for Pro.</p></div>
        )}
      </div>
    </div>
  );
}

function Concierge({ user }) {
  const [f, setF] = useState({ brief: "", budget: "", timeline: "" });
  const [sent, setSent] = useState(null);
  if (!user) return <div className="bg-white border border-gray-200 rounded-xl p-6"><h2 className="font-semibold">Hiring concierge</h2><p className="text-sm text-gray-600 mt-1"><Link className="text-emerald-700" href="/signin">Sign in</Link> to send a request.</p></div>;
  async function submit(e) {
    e.preventDefault();
    try { setSent(await api("/pro/concierge", "POST", f)); toast.success("Request sent"); } catch (err) { toast.error(err.message); }
  }
  return (
    <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-6 space-y-3">
      <h2 className="font-semibold">Hiring concierge</h2>
      {sent ? <p className="text-sm text-emerald-800" data-testid="concierge-sent">{sent.message} You can follow up in <Link className="underline" href="/support">Support</Link>.</p> : <>
        <textarea className={input} rows={4} minLength={20} placeholder="What do you need built? Skills, scope, anything we should know." value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Budget (e.g. $5k)" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
          <input className={input} placeholder="Timeline" value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })} />
        </div>
        <button className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium">Get a shortlist</button>
      </>}
    </form>
  );
}

function Apply() {
  const [st, setSt] = useState(null);
  const [f, setF] = useState({ headline: "", experienceYears: "3", portfolioLinks: "", clients: "" });
  useEffect(() => { api("/pro/me").then(setSt).catch(() => {}); }, []);
  async function submit(e) {
    e.preventDefault();
    try {
      setSt(await api("/pro/apply", "POST", { ...f, experienceYears: Number(f.experienceYears), portfolioLinks: f.portfolioLinks.split(/\s+/).filter(Boolean) }));
      toast.success("Application sent");
    } catch (err) { toast.error(err.message); }
  }
  if (st?.isPro) return <div className="bg-white border border-emerald-200 rounded-xl p-6"><h2 className="font-semibold">You&rsquo;re a Pro seller</h2><p className="text-sm text-gray-600 mt-1">Your Pro badge shows on your gigs and profile.</p></div>;
  if (st?.application?.status === "pending") return <div className="bg-white border border-gray-200 rounded-xl p-6"><h2 className="font-semibold">Application under review</h2><p className="text-sm text-gray-600 mt-1">We&rsquo;ll notify you when it&rsquo;s reviewed.</p></div>;
  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
      <h2 className="font-semibold">Apply for Pro</h2>
      {st?.application?.status === "rejected" ? <p className="text-sm text-amber-700">Last application wasn&rsquo;t approved{st.application.reviewNote ? `: ${st.application.reviewNote}` : ""}. You can apply again.</p> : null}
      <input className={input} minLength={10} maxLength={120} placeholder="Headline, e.g. Senior product designer for fintech" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} required />
      <label className="block text-sm">Years of experience (min {st?.minYears || 2})<input className={input} type="number" min={st?.minYears || 2} max={60} value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} required /></label>
      <input className={input} placeholder="Portfolio links (2+, space separated)" value={f.portfolioLinks} onChange={(e) => setF({ ...f, portfolioLinks: e.target.value })} required />
      <input className={input} placeholder="Notable clients (optional)" value={f.clients} onChange={(e) => setF({ ...f, clients: e.target.value })} />
      <button className="px-4 py-2.5 rounded-lg bg-gray-900 text-white font-medium">Send application</button>
    </form>
  );
}
