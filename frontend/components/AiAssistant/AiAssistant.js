"use client";
// /ai-assistant: AI workspace — gig copy, project briefs, reply ideas,
// and seller matches. Uses HttpOnly session cookies (credentials:include).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
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

const box = "bg-white border border-gray-200 rounded-xl p-6 space-y-3";
const btn = "px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50";
const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success("Copied"));

const TABS = [
  { id: "gig", label: "Gig writer" },
  { id: "brief", label: "Brief writer" },
  { id: "replies", label: "Reply ideas" },
  { id: "matches", label: "Seller matches" },
];

export default function AiAssistant() {
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState("gig");
  useEffect(() => {
    api("/ai/status").then(setStatus).catch(() => setStatus({ enabled: false }));
  }, []);
  if (status && !status.enabled) {
    return (
      <div className="container py-12" data-testid="ai-workspace">
        <h1 className="text-3xl font-semibold">AI workspace</h1>
        <p className="mt-3 text-gray-600">AI helpers are turned off on this site.</p>
      </div>
    );
  }
  return (
    <div className="container py-12 space-y-6" data-testid="ai-workspace">
      <header>
        <h1 className="text-3xl font-semibold">AI workspace</h1>
        <p className="mt-1 text-sm text-gray-600">
          Draft gig copy, project briefs and replies, or match sellers to your open requests.
          {status?.provider === "mock" ? " Demo mode uses built-in templates." : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/briefs" className="text-emerald-700 hover:underline">
            Open project brief →
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/requests" className="text-emerald-700 hover:underline">
            Buyer requests
          </Link>
        </div>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="AI tools">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl">
        {tab === "gig" && <GigWriter />}
        {tab === "brief" && <BriefWriter />}
        {tab === "replies" && <Replies />}
        {tab === "matches" && <Matches />}
      </div>
    </div>
  );
}

function GigWriter() {
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={box}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const d = await api("/ai/gig-description", "POST", { title, skills });
          setOut(d.text);
        } catch (er) {
          toast.error(er.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Gig description writer</h2>
      <input className={input} placeholder="Gig title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className={input} placeholder="Skills (comma separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
      <button className={btn} disabled={busy}>
        {busy ? "Writing…" : "Write"}
      </button>
      {out && (
        <>
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">{out}</pre>
          <button type="button" className="text-sm text-emerald-700" onClick={() => copy(out)}>
            Copy
          </button>
        </>
      )}
    </form>
  );
}

function BriefWriter() {
  const [idea, setIdea] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={box}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          setOut(await api("/ai/brief", "POST", { idea }));
        } catch (er) {
          toast.error(er.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Request brief writer</h2>
      <p className="text-xs text-gray-500">
        Prefer a structured brief? Use the{" "}
        <Link href="/briefs" className="text-emerald-700 hover:underline">
          project brief builder
        </Link>
        .
      </p>
      <textarea className={input} rows={3} placeholder="Describe what you need" value={idea} onChange={(e) => setIdea(e.target.value)} required />
      <button className={btn} disabled={busy}>
        {busy ? "Writing…" : "Write brief"}
      </button>
      {out && (
        <>
          <div className="font-medium">{out.title}</div>
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">{out.description}</pre>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" className="text-emerald-700" onClick={() => copy(`${out.title}\n\n${out.description}`)}>
              Copy
            </button>
            <Link href="/briefs" className="text-emerald-700 hover:underline">
              Continue in brief builder →
            </Link>
          </div>
        </>
      )}
    </form>
  );
}

function Replies() {
  const [message, setMessage] = useState("");
  const [out, setOut] = useState([]);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={box}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const d = await api("/ai/replies", "POST", { message });
          setOut(d.suggestions || []);
        } catch (er) {
          toast.error(er.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Reply ideas</h2>
      <textarea
        className={input}
        rows={3}
        placeholder="Paste the message you received"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <button className={btn} disabled={busy}>
        {busy ? "Thinking…" : "Suggest replies"}
      </button>
      <ul className="space-y-2">
        {out.map((s) => (
          <li key={s}>
            <button type="button" className="text-left text-sm bg-gray-50 p-2 rounded w-full hover:bg-gray-100" onClick={() => copy(s)}>
              {s}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}

function Matches() {
  const [requests, setRequests] = useState([]);
  const [rid, setRid] = useState("");
  const [out, setOut] = useState(null);
  useEffect(() => {
    api("/requests/mine?limit=50")
      .then((d) => setRequests((d?.results || []).filter((r) => r.status === "open")))
      .catch(() => {});
  }, []);
  return (
    <div className={box}>
      <h2 className="font-semibold">Seller matches for your requests</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">
          Post a buyer request or{" "}
          <Link className="text-emerald-700" href="/briefs">
            project brief
          </Link>{" "}
          to get matches.
        </p>
      ) : (
        <>
          <select
            className={input}
            value={rid}
            onChange={(e) => {
              setRid(e.target.value);
              setOut(null);
              if (e.target.value) {
                api(`/ai/match/${e.target.value}`)
                  .then(setOut)
                  .catch((er) => toast.error(er.message));
              }
            }}
          >
            <option value="">Choose a request…</option>
            {requests.map((r) => (
              <option key={r.id || r._id} value={r.id || r._id}>
                {r.title}
              </option>
            ))}
          </select>
          {out &&
            (out.results.length ? (
              <ul className="text-sm divide-y">
                {out.results.map((m) => (
                  <li key={m.seller.id || m.seller._id} className="py-2 flex gap-2">
                    <Link className="flex-1 text-emerald-700" href={`/${m.seller.username}`}>
                      {m.seller.fullName}
                    </Link>
                    <span className="text-gray-500">score {m.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No close matches yet — try{" "}
                <Link className="text-emerald-700" href="/talent">
                  talent search
                </Link>
                .
              </p>
            ))}
        </>
      )}
    </div>
  );
}
