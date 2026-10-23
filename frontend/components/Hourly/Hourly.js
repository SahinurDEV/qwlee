"use client";
// /hourly: hourly contracts with weekly timesheets (Upwork-style).
//   /hourly            list + "Offer an hourly contract" form
//   /hourly?id=<id>    one contract: log time (seller), invoices (both)
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  useGetHourlyContractsQuery, useGetHourlyContractQuery, useCreateHourlyContractMutation, useHourlyActionMutation,
  useLogHourlyTimeMutation, useDeleteHourlyTimeMutation, useHourlyInvoiceActionMutation, useTopUpBalanceMutation,
} from "@/app/redux/features/hourlyApi";

const idOf = (v) => String(v?.id || v?._id || v || "");
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const day = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const errMsg = (r, f) => r?.error?.data?.message || f;
const input = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";
const TONE = { offered: "bg-sky-50 text-sky-700", active: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", ended: "bg-gray-100 text-gray-600", declined: "bg-rose-50 text-rose-700", review: "bg-sky-50 text-sky-700", paid: "bg-emerald-50 text-emerald-700", disputed: "bg-rose-50 text-rose-700", unpaid: "bg-amber-50 text-amber-700" };
const Pill = ({ s }) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TONE[s] || "bg-gray-100"}`}>{s}</span>;

export default function Hourly() {
  const id = useSearchParams().get("id");
  return <div className="container py-10">{id ? <Detail id={id} /> : <List />}</div>;
}

function List() {
  const params = useSearchParams();
  const { data, isLoading } = useGetHourlyContractsQuery();
  const [create, { isLoading: saving }] = useCreateHourlyContractMutation();
  const [f, setF] = useState({ sellerUsername: params.get("seller") || "", title: "", rate: "25", weeklyLimit: "10", description: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    const r = await create({ ...f, rate: Number(f.rate), weeklyLimit: Number(f.weeklyLimit) });
    if (r.error) return toast.error(errMsg(r, "Could not send the offer"));
    toast.success("Contract offer sent");
    setF((x) => ({ ...x, title: "", description: "" }));
  }
  return (
    <>
      <h1 className="text-3xl font-semibold">Hourly contracts</h1>
      <p className="mt-1 text-gray-600">Pay by the hour with a weekly limit. Sellers log time; each week is invoiced on Monday and you have 5 days to review it before it&rsquo;s paid from your balance.</p>
      <div className="mt-6 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3" data-testid="hourly-list">
          {isLoading ? <p className="text-gray-500">Loading…</p> : null}
          {(data?.results || []).length === 0 && !isLoading ? <p className="text-gray-500">No hourly contracts yet.</p> : null}
          {(data?.results || []).map((c) => (
            <Link key={idOf(c)} href={`/hourly?id=${idOf(c)}`} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{c.title}</div>
                <Pill s={c.status} />
              </div>
              <div className="text-sm text-gray-500 mt-1">{money(c.rate)}/h · up to {c.weeklyLimit} h/week · {c.buyerId?.fullName} → {c.sellerId?.fullName}</div>
            </Link>
          ))}
        </div>
        <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-5 space-y-3 h-fit">
          <h2 className="font-semibold">Offer an hourly contract</h2>
          <label className="block"><span className="text-sm">Seller username</span><input className={input} value={f.sellerUsername} onChange={set("sellerUsername")} required /></label>
          <label className="block"><span className="text-sm">Title</span><input className={input} minLength={5} maxLength={120} value={f.title} onChange={set("title")} required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="text-sm">Rate ($/h)</span><input className={input} type="number" min={3} max={999} value={f.rate} onChange={set("rate")} required /></label>
            <label><span className="text-sm">Hours / week</span><input className={input} type="number" min={1} max={80} value={f.weeklyLimit} onChange={set("weeklyLimit")} required /></label>
          </div>
          <label className="block"><span className="text-sm">Details (optional)</span><textarea className={input} rows={3} value={f.description} onChange={set("description")} /></label>
          <button disabled={saving} className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60">Send offer</button>
        </form>
      </div>
    </>
  );
}

function Detail({ id }) {
  const { data, isLoading } = useGetHourlyContractQuery(id);
  const [act] = useHourlyActionMutation();
  const [log, { isLoading: logging }] = useLogHourlyTimeMutation();
  const [del] = useDeleteHourlyTimeMutation();
  const [invAct] = useHourlyInvoiceActionMutation();
  const [topUp] = useTopUpBalanceMutation();
  const [t, setT] = useState({ hours: "1", memo: "", date: new Date().toISOString().slice(0, 10) });
  if (isLoading) return <p className="text-gray-500">Loading…</p>;
  if (!data) return <p className="text-gray-500">Contract not found.</p>;
  const { contract: c, role, thisWeek } = data;
  const run = async (p, okMsg) => { const r = await p; if (r.error) toast.error(errMsg(r, "Something went wrong")); else if (okMsg) toast.success(okMsg); };
  return (
    <div className="space-y-6">
      <Link href="/hourly" className="text-sm text-emerald-700">← All hourly contracts</Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{c.title} <Pill s={c.status} /></h1>
          <p className="text-gray-600 mt-1">{money(c.rate)}/h · up to {c.weeklyLimit} h/week · client {c.buyerId?.fullName} · freelancer {c.sellerId?.fullName}</p>
          {c.description ? <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{c.description}</p> : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          {role === "seller" && c.status === "offered" && <>
            <button onClick={() => run(act({ id, action: "accept" }), "Contract started")} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Accept</button>
            <button onClick={() => run(act({ id, action: "decline" }))} className="px-4 py-2 rounded-lg border">Decline</button>
          </>}
          {role === "buyer" && c.status === "active" && <button onClick={() => run(act({ id, action: "pause" }))} className="px-4 py-2 rounded-lg border">Pause</button>}
          {role === "buyer" && c.status === "paused" && <button onClick={() => run(act({ id, action: "resume" }))} className="px-4 py-2 rounded-lg border">Resume</button>}
          {["offered", "active", "paused"].includes(c.status) && <button onClick={() => run(act({ id, action: "end" }), "Contract ended")} className="px-4 py-2 rounded-lg border text-rose-700">End contract</button>}
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold">This week: {thisWeek.hours} of {thisWeek.limit} h</h2>
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (thisWeek.hours / thisWeek.limit) * 100)}%` }} /></div>
        {role === "seller" && c.status === "active" && (
          <form className="mt-4 grid md:grid-cols-[140px_100px_1fr_auto] gap-3 items-end" onSubmit={(e) => { e.preventDefault(); run(log({ id, ...t, hours: Number(t.hours) }), "Time logged"); }} data-testid="log-time">
            <label><span className="text-sm">Date</span><input className={input} type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} /></label>
            <label><span className="text-sm">Hours</span><input className={input} type="number" min={0.25} max={24} step={0.25} value={t.hours} onChange={(e) => setT({ ...t, hours: e.target.value })} /></label>
            <label><span className="text-sm">What you worked on</span><input className={input} maxLength={500} value={t.memo} onChange={(e) => setT({ ...t, memo: e.target.value })} /></label>
            <button disabled={logging} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Log time</button>
          </form>
        )}
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1">Date</th><th>Hours</th><th>Memo</th><th></th></tr></thead>
          <tbody>
            {[...c.entries].reverse().map((e) => (
              <tr key={idOf(e)} className="border-t border-gray-100">
                <td className="py-1.5">{day(e.date)}</td><td>{e.hours}</td><td className="text-gray-600">{e.memo}</td>
                <td className="text-right">{role === "seller" && !e.invoiceId ? <button className="text-rose-600 text-xs" onClick={() => run(del({ id, entryId: idOf(e) }))}>Remove</button> : e.invoiceId ? <span className="text-xs text-gray-400">invoiced</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Weekly invoices</h2>
          {role === "buyer" && <button className="text-sm text-emerald-700" onClick={() => run(topUp(100), "$100 added to your balance (demo)")}>Add $100 to balance (demo)</button>}
        </div>
        {c.invoices.length === 0 ? <p className="text-sm text-gray-500 mt-2">No invoices yet. Each week is invoiced when it ends.</p> : null}
        <div className="mt-3 space-y-2">
          {[...c.invoices].reverse().map((i) => (
            <div key={idOf(i)} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3 flex-wrap">
              <div className="text-sm">Week of {day(i.weekStart)} · {i.hours} h · <b>{money(i.amount)}</b> <Pill s={i.status} />
                {i.status === "review" ? <span className="text-gray-500"> · auto-paid {day(i.reviewUntil)}</span> : null}
                {i.status === "paid" && role === "seller" ? <span className="text-gray-500"> · you got {money(i.net)} after {i.feePercent}% fee</span> : null}
              </div>
              {role === "buyer" && ["review", "unpaid"].includes(i.status) && (
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm" onClick={() => run(invAct({ id, invId: idOf(i), action: i.status === "unpaid" ? "pay" : "approve" }), "Invoice paid")}>{i.status === "unpaid" ? "Pay now" : "Approve & pay"}</button>
                  {i.status === "review" && <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => { const reason = window.prompt("What's wrong with this week's hours?"); if (reason) run(invAct({ id, invId: idOf(i), action: "dispute", reason }), "Sent to support"); }}>Dispute</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
