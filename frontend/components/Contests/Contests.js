"use client";
// /contests            open contests + "Start a contest" form
// /contests?id=<id>    one contest: entries, enter (sellers), award/handover
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import useUser from "@/hooks/useUser";
import { useGetContestsQuery, useGetContestQuery, useCreateContestMutation, useContestActionMutation } from "@/app/redux/features/contestsApi";

const idOf = (v) => String(v?.id || v?._id || v || "");
const money = (n) => `$${Number(n || 0).toFixed(0)}`;
const errMsg = (r, f) => r?.error?.data?.message || f;
const input = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";
const left = (d) => { const h = Math.max(0, Math.round((new Date(d) - Date.now()) / 36e5)); return h > 48 ? `${Math.round(h / 24)} days left` : `${h} h left`; };
const splitLinks = (s) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);

export default function Contests() {
  const id = useSearchParams().get("id");
  return <div className="container py-10">{id ? <Detail id={id} /> : <List />}</div>;
}

function List() {
  const user = useUser();
  const { data, isLoading } = useGetContestsQuery("open");
  const [create, { isLoading: saving }] = useCreateContestMutation();
  const [f, setF] = useState({ title: "", brief: "", prize: "100", days: "7", sealed: false });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  async function submit(e) {
    e.preventDefault();
    const r = await create({ ...f, prize: Number(f.prize), days: Number(f.days) });
    if (r.error) return toast.error(errMsg(r, "Could not post the contest"));
    toast.success("Contest posted");
    setF((x) => ({ ...x, title: "", brief: "" }));
  }
  return (
    <>
      <h1 className="text-3xl font-semibold">Contests</h1>
      <p className="mt-1 text-gray-600">Post a brief and a prize, get many entries, pay only the winner. The prize is held from your balance until you accept the final files.</p>
      <div className="mt-6 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 grid sm:grid-cols-2 gap-4 h-fit" data-testid="contest-list">
          {isLoading ? <p className="text-gray-500">Loading…</p> : null}
          {(data?.results || []).length === 0 && !isLoading ? <p className="text-gray-500">No open contests right now.</p> : null}
          {(data?.results || []).map((c) => (
            <Link key={idOf(c)} href={`/contests?id=${idOf(c)}`} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300">
              <div className="text-2xl font-semibold text-emerald-700">{money(c.prize)}</div>
              <div className="font-medium mt-1 line-clamp-2">{c.title}</div>
              <div className="text-sm text-gray-500 mt-2">{c.entryCount} entries · {left(c.deadline)}{c.sealed ? " · sealed" : ""}</div>
            </Link>
          ))}
        </div>
        {user ? (
          <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-5 space-y-3 h-fit">
            <h2 className="font-semibold">Start a contest</h2>
            <label className="block"><span className="text-sm">Title</span><input className={input} minLength={5} maxLength={120} value={f.title} onChange={set("title")} required /></label>
            <label className="block"><span className="text-sm">Brief</span><textarea className={input} rows={4} minLength={20} value={f.brief} onChange={set("brief")} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="text-sm">Prize ($)</span><input className={input} type="number" min={20} value={f.prize} onChange={set("prize")} required /></label>
              <label><span className="text-sm">Runs for (days)</span><input className={input} type="number" min={1} max={30} value={f.days} onChange={set("days")} required /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sealed} onChange={set("sealed")} /> Sealed (sellers can&rsquo;t see each other&rsquo;s entries)</label>
            <button disabled={saving} className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60">Post contest</button>
          </form>
        ) : null}
      </div>
    </>
  );
}

function Detail({ id }) {
  const user = useUser();
  const { data: c, isLoading } = useGetContestQuery(id);
  const [act] = useContestActionMutation();
  const [entry, setEntry] = useState({ description: "", links: "" });
  const [hand, setHand] = useState({ note: "", links: "" });
  if (isLoading) return <p className="text-gray-500">Loading…</p>;
  if (!c) return <p className="text-gray-500">Contest not found.</p>;
  const run = async (body, okMsg) => { const r = await act({ id, ...body }); if (r.error) toast.error(errMsg(r, "Something went wrong")); else toast.success(okMsg); };
  const winner = (c.entries || []).find((e) => e.status === "winner");
  const iAmWinner = winner && user && idOf(winner.sellerId) === String(user.id || user._id);
  return (
    <div className="space-y-6">
      <Link href="/contests" className="text-sm text-emerald-700">← All contests</Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-gray-600 mt-1">Prize <b>{money(c.prize)}</b> · {c.entryCount} entries · {c.status === "open" ? left(c.deadline) : c.status}{c.sealed ? " · sealed" : ""}</p>
          <p className="mt-3 text-gray-800 whitespace-pre-line">{c.brief}</p>
        </div>
        {c.isOwner && ["open", "judging"].includes(c.status) && c.entryCount === 0 && (
          <button onClick={() => run({ path: "cancel" }, "Cancelled and refunded")} className="px-4 py-2 rounded-lg border text-rose-700">Cancel &amp; refund</button>
        )}
      </div>

      {user?.role === "freelancer" && !c.isOwner && c.status === "open" && (
        <form className="bg-white border border-emerald-200 rounded-xl p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); run({ path: "entries", description: entry.description, links: splitLinks(entry.links) }, "Entry submitted"); }}>
          <h2 className="font-semibold">Submit an entry</h2>
          <textarea className={input} rows={3} minLength={10} placeholder="Describe your concept" value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} required />
          <input className={input} placeholder="Links to your work (space separated: image, Figma, Drive…)" value={entry.links} onChange={(e) => setEntry({ ...entry, links: e.target.value })} required />
          <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Submit entry</button>
        </form>
      )}

      {c.status === "handover" && iAmWinner && !c.handover?.submittedAt && (
        <form className="bg-white border border-emerald-200 rounded-xl p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); run({ path: "handover", note: hand.note, links: splitLinks(hand.links) }, "Final files sent"); }}>
          <h2 className="font-semibold">You won! Hand over the final files</h2>
          <textarea className={input} rows={2} placeholder="Notes for the client" value={hand.note} onChange={(e) => setHand({ ...hand, note: e.target.value })} />
          <input className={input} placeholder="Links to final files" value={hand.links} onChange={(e) => setHand({ ...hand, links: e.target.value })} required />
          <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Send final files</button>
        </form>
      )}
      {c.handover?.submittedAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h2 className="font-semibold">Final files</h2>
          {c.handover.note ? <p className="text-sm mt-1">{c.handover.note}</p> : null}
          <ul className="mt-2 text-sm list-disc pl-5">{c.handover.links.map((l) => <li key={l}><a className="text-emerald-700 underline break-all" href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a></li>)}</ul>
          {c.isOwner && c.status === "handover" && <button onClick={() => run({ path: "accept-handover" }, "Prize released")} className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white">Accept &amp; release prize</button>}
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-3">Entries</h2>
        {(c.entries || []).length === 0 ? <p className="text-sm text-gray-500">{c.sealed && !c.isOwner ? "Entries are sealed." : "No entries yet."}</p> : null}
        <div className="grid md:grid-cols-2 gap-4">
          {(c.entries || []).map((e) => (
            <div key={idOf(e)} className={`bg-white border rounded-xl p-4 ${e.status === "winner" ? "border-emerald-500" : "border-gray-200"}`}>
              <div className="flex items-center justify-between"><span className="font-medium">{e.sellerId?.fullName || "Seller"}</span>{e.status !== "active" ? <span className="text-xs text-gray-500">{e.status}</span> : null}</div>
              <p className="text-sm mt-1 text-gray-700">{e.description}</p>
              <ul className="mt-2 text-sm">{(e.links || []).map((l) => <li key={l}><a className="text-emerald-700 underline break-all" href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a></li>)}</ul>
              {c.isOwner && ["open", "judging"].includes(c.status) && e.status === "active" && (
                <button onClick={() => run({ path: "award", entryId: idOf(e) }, "Winner picked")} className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Pick as winner</button>
              )}
              {user && idOf(e.sellerId) === String(user.id || user._id) && e.status === "active" && ["open", "judging"].includes(c.status) && (
                <button onClick={() => run({ path: `entries/${idOf(e)}/withdraw` }, "Entry withdrawn")} className="mt-3 ml-2 px-3 py-1.5 rounded-lg border text-sm">Withdraw</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
