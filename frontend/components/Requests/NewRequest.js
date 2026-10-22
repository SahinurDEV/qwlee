"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateRequestMutation } from "@/app/redux/features/requestsApi";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { RequestsNav, idOf, errMsg } from "./shared";

export default function NewRequest() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", budget: "", deliveryDays: "7", categoriesId: "", subCategoryId: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === "categoriesId" ? { subCategoryId: "" } : {}) }));
  const { data: catData } = useGetAllCategoryQuery({});
  const { data: subData } = useGetAllCategoryQuery({ parentId: form.categoriesId, limit: 100 }, { skip: !form.categoriesId });
  const [createRequest, { isLoading }] = useCreateRequestMutation();

  async function submit(e) {
    e.preventDefault();
    const body = { ...form, budget: Number(form.budget), deliveryDays: Number(form.deliveryDays) };
    if (!body.categoriesId) delete body.categoriesId;
    if (!body.subCategoryId) delete body.subCategoryId;
    const res = await createRequest(body);
    if (res.error) return toast.error(errMsg(res, "Could not post the request"));
    toast.success("Request posted");
    router.push(`/requests/${idOf(res.data)}`);
  }

  const input = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";
  return (
    <div className="container mx-auto px-4 py-8 md:py-10 max-w-3xl">
      <RequestsNav active="new" />
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Post a request</h1>
      <form onSubmit={submit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-5">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className={input} value={form.title} onChange={set("title")} maxLength={120} required minLength={10} placeholder="e.g. Need a logo for my bakery" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Describe what you need</span>
          <textarea className={input} rows={6} value={form.description} onChange={set("description")} maxLength={5000} required minLength={20} />
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
              {(catData?.results || []).map((c) => <option key={idOf(c)} value={idOf(c)}>{c.name}</option>)}
            </select>
          </label>
          {form.categoriesId && (subData?.results || []).length > 0 && (
            <label className="block">
              <span className="text-sm font-medium">Subcategory</span>
              <select className={`${input} bg-white`} value={form.subCategoryId} onChange={set("subCategoryId")}>
                <option value="">Any</option>
                {subData.results.map((c) => <option key={idOf(c)} value={idOf(c)}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button disabled={isLoading} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60">
          {isLoading ? "Posting…" : "Post request"}
        </button>
      </form>
    </div>
  );
}
