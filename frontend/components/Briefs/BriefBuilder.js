"use client";
// Project briefs: structured buyer brief → posts as a marketplace request.
// Optional AI expand fills title/description from a short idea (HttpOnly cookies).
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { base } from "@/lib/constant";
import { useCreateRequestMutation } from "@/app/redux/features/requestsApi";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { RequestsNav, idOf, errMsg } from "@/components/Requests/shared";

const input =
  "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";

async function aiBrief(idea) {
  const r = await fetch(`${base}/v1/ai/brief`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || "AI brief failed");
  return j?.data?.attributes;
}

function composeDescription({ description, goals, deliverables, audience, references }) {
  const parts = [description.trim()];
  if (goals.trim()) parts.push(`\n\nGoals\n${goals.trim()}`);
  if (deliverables.trim()) parts.push(`\n\nDeliverables\n${deliverables.trim()}`);
  if (audience.trim()) parts.push(`\n\nAudience / brand\n${audience.trim()}`);
  if (references.trim()) parts.push(`\n\nReferences\n${references.trim()}`);
  return parts.join("").slice(0, 5000);
}

export default function BriefBuilder() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    goals: "",
    deliverables: "",
    audience: "",
    references: "",
    budget: "",
    deliveryDays: "7",
    categoriesId: "",
    subCategoryId: "",
  });
  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.value,
      ...(k === "categoriesId" ? { subCategoryId: "" } : {}),
    }));
  const { data: catData } = useGetAllCategoryQuery({});
  const { data: subData } = useGetAllCategoryQuery(
    { parentId: form.categoriesId, limit: 100 },
    { skip: !form.categoriesId }
  );
  const [createRequest, { isLoading }] = useCreateRequestMutation();

  async function expandAi(e) {
    e.preventDefault();
    if (idea.trim().length < 8) return toast.warning("Add a bit more detail for AI");
    setAiBusy(true);
    try {
      const out = await aiBrief(idea.trim());
      setForm((f) => ({
        ...f,
        title: (out?.title || f.title).slice(0, 120),
        description: out?.description || f.description,
      }));
      toast.success("Brief drafted — edit the sections below");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const description = composeDescription(form);
    if (description.length < 20) return toast.error("Add more detail to the brief");
    const body = {
      title: form.title,
      description,
      budget: Number(form.budget),
      deliveryDays: Number(form.deliveryDays),
      categoriesId: form.categoriesId || undefined,
      subCategoryId: form.subCategoryId || undefined,
    };
    if (!body.categoriesId) delete body.categoriesId;
    if (!body.subCategoryId) delete body.subCategoryId;
    const res = await createRequest(body);
    if (res.error) return toast.error(errMsg(res, "Could not post the brief"));
    toast.success("Brief posted as a request");
    router.push(`/requests/${idOf(res.data)}`);
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-10 max-w-3xl" data-testid="brief-builder">
      <RequestsNav active="briefs" />
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project brief</h1>
        <p className="mt-1 text-sm text-gray-600">
          Structure what you need so sellers can offer accurately. Posting creates a buyer request on{" "}
          <Link href="/requests" className="text-emerald-700 hover:underline">
            the board
          </Link>
          .
        </p>
      </header>

      <form onSubmit={expandAi} className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-violet-900">Start with AI (optional)</div>
        <textarea
          className={input}
          rows={2}
          placeholder="Short idea, e.g. redesign checkout for a D2C skincare brand"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <button
          type="submit"
          disabled={aiBusy || idea.trim().length < 8}
          className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {aiBusy ? "Drafting…" : "Draft with AI"}
        </button>
      </form>

      <form onSubmit={submit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-5">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className={input}
            value={form.title}
            onChange={set("title")}
            maxLength={120}
            required
            minLength={10}
            placeholder="e.g. Need a logo for my bakery"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Overview</span>
          <textarea
            className={input}
            rows={4}
            value={form.description}
            onChange={set("description")}
            maxLength={5000}
            required
            minLength={20}
            placeholder="What is the project and why now?"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Goals</span>
          <textarea className={input} rows={2} value={form.goals} onChange={set("goals")} placeholder="Outcomes you care about" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deliverables</span>
          <textarea
            className={input}
            rows={2}
            value={form.deliverables}
            onChange={set("deliverables")}
            placeholder="Files, formats, revisions, handoff"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Audience / brand</span>
          <textarea className={input} rows={2} value={form.audience} onChange={set("audience")} placeholder="Who is this for?" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">References</span>
          <textarea className={input} rows={2} value={form.references} onChange={set("references")} placeholder="Links or examples you like" />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Budget (USD)</span>
            <input className={input} type="number" min={5} max={100000} value={form.budget} onChange={set("budget")} required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Delivery (days)</span>
            <input className={input} type="number" min={1} max={90} value={form.deliveryDays} onChange={set("deliveryDays")} required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Category</span>
            <select className={`${input} bg-white`} value={form.categoriesId} onChange={set("categoriesId")}>
              <option value="">Any</option>
              {(catData?.results || []).map((c) => (
                <option key={idOf(c)} value={idOf(c)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {form.categoriesId && (subData?.results || []).length > 0 && (
            <label className="block">
              <span className="text-sm font-medium">Subcategory</span>
              <select className={`${input} bg-white`} value={form.subCategoryId} onChange={set("subCategoryId")}>
                <option value="">Any</option>
                {subData.results.map((c) => (
                  <option key={idOf(c)} value={idOf(c)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          disabled={isLoading}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {isLoading ? "Posting…" : "Post brief"}
        </button>
      </form>
    </div>
  );
}
