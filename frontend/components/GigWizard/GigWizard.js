"use client";
// Fiverr-style gig wizard shared by "create" and "edit".
//
// Steps: Overview → Pricing → Description & FAQ → Requirements → Gallery → Publish.
// - Live validation: every field is validated on each change; errors show
//   once a field is touched or the seller tries to move on.
// - Autosave: all text fields are saved to localStorage (per gig) while
//   typing. Image files can't be stored there, so they're kept in memory
//   only and the seller is told so.
// - Gallery: drag-and-drop or click upload, drag to reorder, first image
//   is the cover, up to 6 images, plus an optional YouTube/Vimeo/mp4 link.
// - Create posts multipart to POST /gig. Edit uploads new files with
//   POST /gig/image, then PATCHes fields and the final image order.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IoArrowBack, IoArrowForward, IoCheckmarkCircle, IoCloudUploadOutline, IoClose,
  IoAlertCircle, IoReorderThree, IoAdd, IoTrashOutline, IoTimeOutline, IoRefreshOutline, IoStar,
} from "react-icons/io5";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { useAddGigMutation } from "@/app/redux/features/addGigApi";
import { useEditGigMutation } from "@/app/redux/features/editGigApi";
import { usePostGigImageUpoadMutation } from "@/app/redux/features/postGigImageUpoadApi";
import { cleanGigExtras } from "@/components/common/GigExtrasEditor";
import { imgUrl } from "@/lib/constant";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const STEPS = [
  { key: "overview", label: "Overview" },
  { key: "pricing", label: "Pricing" },
  { key: "description", label: "Description & FAQ" },
  { key: "requirements", label: "Requirements" },
  { key: "gallery", label: "Gallery" },
  { key: "publish", label: "Publish" },
];
const TIERS = ["Basic", "Standard", "Premium"];
const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_RE = /^https:\/\/((www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\/.+|.+\.(mp4|webm)(\?.*)?)$/i;

const blankPackage = (name, days) => ({ name, description: "", price: "", deliveryDate: days, revisions: "", features: ["", "", ""] });
export const EMPTY_GIG = {
  title: "",
  categoryId: "",
  subCategoryId: "",
  tags: [],
  threeTiers: true,
  packages: [blankPackage("Basic", 3), blankPackage("Standard", 7), blankPackage("Premium", 14)],
  description: "",
  faq: [],
  requirementQuestions: [{ question: "", required: true }],
  extras: [],
  video: "",
};

const stripHtml = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const idOf = (v) => String(v?.id || v?._id || v || "");

// Pure validation: returns { stepIndex: { field: message } }.
export function validateGig(d, gallery) {
  const e = STEPS.map(() => ({}));
  const t = d.title.trim();
  if (t.length < 15) e[0].title = "Use at least 15 characters so buyers understand your service.";
  else if (t.length > 80) e[0].title = "Keep the title under 80 characters.";
  if (!d.categoryId) e[0].categoryId = "Choose a category.";
  if (d.tags.length > 5) e[0].tags = "Use at most 5 tags.";

  const pkgs = d.threeTiers ? d.packages : d.packages.slice(0, 1);
  pkgs.forEach((p, i) => {
    const price = Number(p.price);
    if (!String(p.name).trim()) e[1][`name${i}`] = "Name required";
    if (!(price >= 5 && price <= 100000)) e[1][`price${i}`] = "$5 – $100,000";
    const days = Number(p.deliveryDate);
    if (!(Number.isInteger(days) && days >= 1 && days <= 90)) e[1][`days${i}`] = "1 – 90 days";
    if (p.revisions !== "" && !(Number(p.revisions) >= 0 && Number(p.revisions) <= 99)) e[1][`rev${i}`] = "0 – 99";
    if (!p.features.some((f) => f.trim())) e[1][`feat${i}`] = "Add at least one feature";
    if (i > 0 && price && Number(pkgs[i - 1].price) && price <= Number(pkgs[i - 1].price)) e[1][`price${i}`] = `Should cost more than ${pkgs[i - 1].name || "the previous tier"}`;
  });

  const words = stripHtml(d.description).split(" ").filter(Boolean).length;
  if (stripHtml(d.description).length < 120) e[2].description = `Write at least 120 characters (${stripHtml(d.description).length} so far).`;
  else if (words > 1200) e[2].description = "Keep it under 1,200 words.";
  d.faq.forEach((f, i) => {
    if (f.question.trim() && !f.answer.trim()) e[2][`faq${i}`] = "Add an answer or remove this question.";
  });

  if (!d.requirementQuestions.some((q) => q.question.trim())) e[3].requirements = "Ask buyers at least one question so you can start work.";
  d.extras.forEach((x, i) => {
    if (x.title.trim() && !(Number(x.price) >= 1)) e[3][`extra${i}`] = "Extras need a price of at least $1.";
  });

  if (gallery.length < 1) e[4].images = "Add at least one image. The first one is your cover.";
  if (gallery.length > MAX_IMAGES) e[4].images = `At most ${MAX_IMAGES} images.`;
  if (d.video.trim() && !VIDEO_RE.test(d.video.trim())) e[4].video = "Use a YouTube or Vimeo link, or an https .mp4/.webm URL.";
  return e;
}

const inputCls = (bad) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    bad ? "border-rose-400 focus:ring-rose-200" : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-100"
  }`;
const Err = ({ msg }) => (msg ? <p className="mt-1 flex items-center gap-1 text-xs text-rose-600"><IoAlertCircle />{msg}</p> : null);
const Field = ({ label, hint, children, err, right }) => (
  <div>
    <div className="mb-1 flex items-end justify-between gap-2">
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      {right}
    </div>
    {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
    {children}
    <Err msg={err} />
  </div>
);

export default function GigWizard({ mode = "create", gig = null }) {
  const router = useRouter();
  const draftKey = `qwlee:gig-draft:${mode === "edit" ? idOf(gig) : "new"}`;
  const [step, setStep] = useState(0);
  const [data, setData] = useState(EMPTY_GIG);
  const [gallery, setGallery] = useState([]); // [{key, url?, file?, preview}]
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [descLen, setDescLen] = useState(null);
  const joditConfig = useMemo(() => ({ readonly: false, height: 320, toolbarAdaptive: true, buttons: "bold,italic,underline,ul,ol,link,undo,redo", statusbar: false, placeholder: "Describe your service…" }), []);
  const dragIdx = useRef(null);
  const fileInput = useRef(null);
  const hydrated = useRef(false);

  const [addGig] = useAddGigMutation();
  const [editGig] = useEditGigMutation();
  const [uploadImages] = usePostGigImageUpoadMutation();
  const { data: catData } = useGetAllCategoryQuery({ limit: 100 });
  const { data: subData } = useGetAllCategoryQuery({ parentId: data.categoryId, limit: 100 }, { skip: !data.categoryId });
  const categories = catData?.results || [];
  const subcategories = subData?.results || [];

  // Initial state: server gig (edit) overlaid by a local draft, if any.
  useEffect(() => {
    if (hydrated.current || (mode === "edit" && !gig)) return;
    hydrated.current = true;
    let base = EMPTY_GIG;
    if (mode === "edit" && gig) {
      const pk = (gig.package || []).map((p, i) => ({
        name: p.name || TIERS[i] || "",
        description: p.description || "",
        price: p.price ?? "",
        deliveryDate: p.deliveryDate ?? 7,
        revisions: p.revisions ?? "",
        features: [...(p.features || []).map((f) => (typeof f === "string" ? f : f.feature || "")), "", ""].slice(0, Math.max(3, (p.features || []).length)),
      }));
      while (pk.length < 3) pk.push(blankPackage(TIERS[pk.length], [3, 7, 14][pk.length]));
      base = {
        title: gig.title || "",
        categoryId: idOf(gig.categoriesId),
        subCategoryId: gig.subCategoryId ? idOf(gig.subCategoryId) : "",
        tags: gig.tags || [],
        threeTiers: (gig.package || []).length !== 1,
        packages: pk,
        description: gig.description || "",
        faq: (gig.faq || []).map((f) => ({ question: f.question || "", answer: f.answer || "" })),
        requirementQuestions: (gig.requirementQuestions || []).map((q) => ({ question: q.question || "", required: !!q.required })),
        extras: (gig.extras || []).map((x) => ({ ...(x._id || x.id ? { _id: x._id || x.id } : {}), title: x.title || "", price: x.price ?? "", deliveryDays: x.deliveryDays ?? 0 })),
        video: gig.video || "",
      };
      if (!base.requirementQuestions.length) base.requirementQuestions = [{ question: "", required: true }];
      setGallery((gig.images || []).map((u) => ({ key: u, url: u, preview: imgUrl(u) })));
    }
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.data) {
        base = { ...base, ...saved.data };
        setSavedAt(saved.at);
        setRestored(true);
      }
    } catch {}
    setData(base);
  }, [gig, mode, draftKey]);

  // Autosave (debounced).
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      const at = new Date().toISOString();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ at, data }));
        setSavedAt(at);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [data, draftKey]);

  useEffect(() => () => gallery.forEach((g) => g.file && URL.revokeObjectURL(g.preview)), []); // eslint-disable-line

  const errors = useMemo(() => validateGig(data, gallery), [data, gallery]);
  const stepOk = (i) => Object.keys(errors[i]).length === 0;
  const show = (i, field) => (attempted[i] || touched[field] ? errors[i][field] : undefined);
  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));
  const setPkg = (i, patch) => set({ packages: data.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const tiers = data.threeTiers ? data.packages : data.packages.slice(0, 1);
  const completed = STEPS.slice(0, 5).filter((_, i) => stepOk(i)).length;
  const progress = Math.round((completed / 5) * 100);

  const go = (target) => {
    if (target > step) {
      for (let i = step; i < target; i++) {
        if (!stepOk(i)) {
          setAttempted((a) => ({ ...a, [i]: true }));
          setStep(i);
          toast.error(`Fix the highlighted fields in "${STEPS[i].label}"`);
          return;
        }
      }
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- gallery ----------
  const addFiles = (files) => {
    const list = Array.from(files || []);
    const room = MAX_IMAGES - gallery.length;
    const ok = [];
    for (const f of list) {
      if (!IMAGE_TYPES.includes(f.type)) { toast.error(`${f.name}: use JPG, PNG, WebP or GIF`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: larger than 5 MB`); continue; }
      ok.push(f);
    }
    if (ok.length > room) toast.error(`Only ${MAX_IMAGES} images allowed; extra files skipped.`);
    const items = ok.slice(0, Math.max(0, room)).map((f, i) => ({ key: `f${Date.now()}${i}${f.name}`, file: f, preview: URL.createObjectURL(f) }));
    if (items.length) setGallery((g) => [...g, ...items]);
    touch("images");
  };
  const moveImage = (from, to) => {
    if (from === to || from == null) return;
    setGallery((g) => {
      const n = [...g];
      const [it] = n.splice(from, 1);
      n.splice(to, 0, it);
      return n;
    });
  };

  // ---------- submit ----------
  const payload = () => {
    const ex = cleanGigExtras({ extras: data.extras, faq: data.faq.filter((f) => f.answer.trim()), requirementQuestions: data.requirementQuestions, video: data.video });
    return {
      title: data.title.trim(),
      description: data.description,
      categoriesId: data.categoryId,
      subCategoryId: data.subCategoryId || null,
      tags: data.tags,
      package: tiers.map((p) => ({
        name: p.name.trim(),
        description: p.description.trim(),
        price: Number(p.price),
        deliveryDate: Number(p.deliveryDate),
        ...(p.revisions !== "" ? { revisions: Number(p.revisions) } : {}),
        features: p.features.map((f) => f.trim()).filter(Boolean).map((feature) => ({ feature })),
      })),
      ...ex,
    };
  };

  const submit = async () => {
    const firstBad = STEPS.slice(0, 5).findIndex((_, i) => !stepOk(i));
    if (firstBad !== -1) {
      setAttempted(Object.fromEntries(STEPS.map((_, i) => [i, true])));
      setStep(firstBad);
      toast.error(`"${STEPS[firstBad].label}" still needs attention`);
      return;
    }
    setBusy(true);
    try {
      const p = payload();
      let id;
      if (mode === "create") {
        const fd = new FormData();
        for (const [k, v] of Object.entries(p)) {
          if (v === null || v === undefined) continue;
          fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        gallery.forEach((g) => fd.append("images", g.file));
        const res = await addGig(fd).unwrap();
        id = idOf(res?.data?.attributes);
      } else {
        id = idOf(gig);
        const newFiles = gallery.filter((g) => g.file);
        let uploaded = [];
        if (newFiles.length) {
          const fd = new FormData();
          newFiles.forEach((g) => fd.append("images", g.file));
          const before = new Set(gig.images || []);
          const r = await uploadImages({ gigId: id, formData: fd }).unwrap();
          uploaded = (r?.data?.attributes?.images || []).filter((u) => !before.has(u));
        }
        let k = 0;
        const order = gallery.map((g) => (g.file ? uploaded[k++] : g.url)).filter(Boolean);
        await editGig({ id, data: { ...p, images: order } }).unwrap();
      }
      localStorage.removeItem(draftKey);
      toast.success(mode === "create" ? "Your gig is live!" : "Gig updated");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err?.data?.message || "Could not save the gig. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    window.location.reload();
  };

  const cover = gallery[0]?.preview;
  const minPrice = Math.min(...tiers.map((p) => Number(p.price) || Infinity));

  // ---------- render ----------
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{mode === "create" ? "Create a gig" : "Edit gig"}</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">{STEPS[step].label}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500" data-testid="autosave">
          {savedAt ? <span className="inline-flex items-center gap-1"><IoCheckmarkCircle className="text-emerald-500" />Draft saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : <span>Autosave on</span>}
          {restored && <button type="button" onClick={discardDraft} className="text-rose-600 hover:underline">Discard draft</button>}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-gray-600">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-4 flex gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const ok = i < 5 && stepOk(i);
            const bad = i < 5 && attempted[i] && !ok;
            return (
              <li key={s.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    i === step ? "bg-gray-900 text-white" : bad ? "bg-rose-50 text-rose-700" : ok ? "bg-emerald-50 text-emerald-800" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i === step ? "bg-white text-gray-900" : ok ? "bg-emerald-500 text-white" : bad ? "bg-rose-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                    {ok && i !== step ? "✓" : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 md:p-8">
          {step === 0 && (
            <>
              <Field label="Gig title" hint="As your gig storefront, your title is what buyers see first. Start with “I will…”." err={show(0, "title")} right={<span className={`text-xs ${data.title.length > 80 ? "text-rose-600" : "text-gray-400"}`}>{data.title.length}/80</span>}>
                <textarea rows={2} value={data.title} onBlur={() => touch("title")} onChange={(e) => set({ title: e.target.value })} placeholder="I will design a modern, responsive landing page for your SaaS" className={inputCls(show(0, "title"))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Category" err={show(0, "categoryId")}>
                  <select value={data.categoryId} onBlur={() => touch("categoryId")} onChange={(e) => set({ categoryId: e.target.value, subCategoryId: "" })} className={inputCls(show(0, "categoryId"))}>
                    <option value="">Select a category</option>
                    {categories.map((c) => <option key={idOf(c)} value={idOf(c)}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Subcategory" hint={!data.categoryId ? "Pick a category first." : undefined}>
                  <select disabled={!subcategories.length} value={data.subCategoryId} onChange={(e) => set({ subCategoryId: e.target.value })} className={inputCls(false) + " disabled:bg-gray-50"}>
                    <option value="">{subcategories.length ? "Select a subcategory" : "None"}</option>
                    {subcategories.map((c) => <option key={idOf(c)} value={idOf(c)}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
              <TagInput tags={data.tags} onChange={(tags) => set({ tags })} err={show(0, "tags")} />
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">Offer up to three packages. Buyers compare them side by side.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={data.threeTiers} onChange={(e) => set({ threeTiers: e.target.checked })} />
                  3 packages
                </label>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[640px] text-sm" data-testid="pricing-table">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="w-36 p-3" />
                      {tiers.map((p, i) => (
                        <th key={i} className="p-3">
                          <input value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} className={inputCls(show(1, `name${i}`)) + " font-semibold"} aria-label={`Package ${i + 1} name`} />
                          <Err msg={show(1, `name${i}`)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <Row label="Description">
                      {tiers.map((p, i) => <td key={i} className="p-3 align-top"><textarea rows={3} maxLength={300} value={p.description} onChange={(e) => setPkg(i, { description: e.target.value })} placeholder="Describe the details of your offering" className={inputCls(false)} /></td>)}
                    </Row>
                    <Row label="Delivery time">
                      {tiers.map((p, i) => (
                        <td key={i} className="p-3 align-top">
                          <div className="flex items-center gap-2"><input type="number" min={1} max={90} value={p.deliveryDate} onBlur={() => touch(`days${i}`)} onChange={(e) => setPkg(i, { deliveryDate: e.target.value })} className={inputCls(show(1, `days${i}`))} /><span className="text-xs text-gray-500">days</span></div>
                          <Err msg={show(1, `days${i}`)} />
                        </td>
                      ))}
                    </Row>
                    <Row label="Revisions">
                      {tiers.map((p, i) => (
                        <td key={i} className="p-3 align-top">
                          <input type="number" min={0} max={99} placeholder="On request" value={p.revisions} onChange={(e) => setPkg(i, { revisions: e.target.value })} className={inputCls(show(1, `rev${i}`))} />
                          <Err msg={show(1, `rev${i}`)} />
                        </td>
                      ))}
                    </Row>
                    <Row label="What's included">
                      {tiers.map((p, i) => (
                        <td key={i} className="space-y-2 p-3 align-top">
                          {p.features.map((f, k) => (
                            <div key={k} className="flex gap-1">
                              <input value={f} maxLength={120} placeholder={`Feature ${k + 1}`} onBlur={() => touch(`feat${i}`)} onChange={(e) => setPkg(i, { features: p.features.map((x, j) => (j === k ? e.target.value : x)) })} className={inputCls(false)} />
                              {p.features.length > 1 && <button type="button" aria-label="Remove feature" onClick={() => setPkg(i, { features: p.features.filter((_, j) => j !== k) })} className="px-1 text-gray-400 hover:text-rose-600"><IoClose /></button>}
                            </div>
                          ))}
                          {p.features.length < 10 && <button type="button" onClick={() => setPkg(i, { features: [...p.features, ""] })} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><IoAdd />Add feature</button>}
                          <Err msg={show(1, `feat${i}`)} />
                        </td>
                      ))}
                    </Row>
                    <Row label="Price (USD)">
                      {tiers.map((p, i) => (
                        <td key={i} className="p-3 align-top">
                          <div className="relative"><span className="absolute left-3 top-2 text-gray-400">$</span><input type="number" min={5} value={p.price} onBlur={() => touch(`price${i}`)} onChange={(e) => setPkg(i, { price: e.target.value })} className={inputCls(show(1, `price${i}`)) + " pl-6"} /></div>
                          <Err msg={show(1, `price${i}`)} />
                        </td>
                      ))}
                    </Row>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Description" hint="Briefly describe your gig: what you do, how you work, and why buyers should pick you." err={show(2, "description")} right={<span className={`text-xs ${(descLen ?? stripHtml(data.description).length) < 120 ? "text-amber-600" : "text-emerald-700"}`}>{descLen ?? stripHtml(data.description).length}/120+ chars</span>}>
                <div className={`overflow-hidden rounded-lg border ${show(2, "description") ? "border-rose-400" : "border-gray-300"}`} onBlur={() => touch("description")}>
                  <JoditEditor value={data.description} config={joditConfig} onBlur={(v) => set({ description: v })} onChange={(v) => setDescLen(stripHtml(v).length)} />
                </div>
              </Field>
              <ListEditor
                title="Frequently asked questions"
                hint="Answer common questions up front to save time for you and your buyers."
                items={data.faq}
                max={10}
                empty={{ question: "", answer: "" }}
                onChange={(faq) => set({ faq })}
                render={(f, patch, i) => (
                  <>
                    <input className={inputCls(false)} placeholder="Question" value={f.question} onChange={(e) => patch({ question: e.target.value })} />
                    <textarea rows={2} className={inputCls(show(2, `faq${i}`))} placeholder="Answer" value={f.answer} onBlur={() => touch(`faq${i}`)} onChange={(e) => patch({ answer: e.target.value })} />
                    <Err msg={show(2, `faq${i}`)} />
                  </>
                )}
              />
            </>
          )}

          {step === 3 && (
            <>
              <ListEditor
                title="Questions for the buyer"
                hint="Buyers answer these after ordering. Your delivery clock starts once they do."
                items={data.requirementQuestions}
                max={10}
                empty={{ question: "", required: true }}
                onChange={(requirementQuestions) => { set({ requirementQuestions }); touch("requirements"); }}
                render={(q, patch) => (
                  <>
                    <input className={inputCls(false)} placeholder="e.g. Share your brand colours and any reference sites" value={q.question} onChange={(e) => patch({ question: e.target.value })} />
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" className="accent-emerald-600" checked={!!q.required} onChange={(e) => patch({ required: e.target.checked })} />Answer required</label>
                  </>
                )}
              />
              <Err msg={show(3, "requirements")} />
              <ListEditor
                title="Gig extras (optional)"
                hint="Paid add-ons buyers can tick at checkout."
                items={data.extras}
                max={10}
                empty={{ title: "", price: "", deliveryDays: 0 }}
                onChange={(extras) => set({ extras })}
                render={(x, patch, i) => (
                  <>
                    <div className="grid grid-cols-6 gap-2">
                      <input className={inputCls(false) + " col-span-6 sm:col-span-3"} placeholder="e.g. Source files" value={x.title} onChange={(e) => patch({ title: e.target.value })} />
                      <input type="number" min={1} className={inputCls(show(3, `extra${i}`)) + " col-span-3 sm:col-span-2"} placeholder="Price $" value={x.price} onBlur={() => touch(`extra${i}`)} onChange={(e) => patch({ price: e.target.value })} />
                      <input type="number" min={0} className={inputCls(false) + " col-span-3 sm:col-span-1"} placeholder="+days" title="Extra delivery days" value={x.deliveryDays} onChange={(e) => patch({ deliveryDays: e.target.value })} />
                    </div>
                    <Err msg={show(3, `extra${i}`)} />
                  </>
                )}
              />
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Images" hint={`Up to ${MAX_IMAGES} images (JPG, PNG, WebP or GIF, max 5 MB each). Drag to reorder; the first image is your cover.`} err={show(4, "images")}>
                <div
                  data-testid="dropzone"
                  onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); } }}
                  onClick={() => fileInput.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragOver ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"}`}
                >
                  <IoCloudUploadOutline className="text-3xl text-emerald-600" />
                  <p className="mt-2 text-sm font-semibold text-gray-800">Drag &amp; drop images here, or <span className="text-emerald-700 underline">browse</span></p>
                  <p className="text-xs text-gray-500">{gallery.length}/{MAX_IMAGES} added</p>
                  <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {gallery.length > 0 && (
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="gallery">
                    {gallery.map((g, i) => (
                      <li
                        key={g.key}
                        draggable
                        onDragStart={() => { dragIdx.current = i; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { if (!e.dataTransfer.files?.length) { e.preventDefault(); moveImage(dragIdx.current, i); dragIdx.current = null; } }}
                        className="group relative aspect-[5/3] cursor-move overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.preview} alt={`Gig image ${i + 1}`} className="h-full w-full object-cover" />
                        {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                        {g.file && <span className="absolute bottom-2 left-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">Not uploaded yet</span>}
                        <div className="absolute right-2 top-2 flex gap-1">
                          <span className="rounded-full bg-white/90 p-1 text-gray-700" title="Drag to reorder"><IoReorderThree /></span>
                          <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => moveImage(i, i - 1)} className="rounded-full bg-white/90 px-2 text-xs text-gray-700 disabled:opacity-40">←</button>
                          <button type="button" aria-label="Remove image" onClick={() => setGallery((x) => x.filter((_, j) => j !== i))} className="rounded-full bg-white/90 p-1 text-rose-600"><IoTrashOutline /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
              <Field label="Video (optional)" hint="A YouTube or Vimeo link, or an https .mp4/.webm URL. Gigs with a video tend to convert better." err={show(4, "video")}>
                <input value={data.video} onBlur={() => touch("video")} onChange={(e) => set({ video: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className={inputCls(show(4, "video"))} />
              </Field>
              {mode === "create" && gallery.some((g) => g.file) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Images are uploaded when you publish. Unlike the text fields, they aren&apos;t part of the autosaved draft.</p>}
            </>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">Review your gig. Everything below must be green before you can publish.</p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {STEPS.slice(0, 5).map((s, i) => (
                  <li key={s.key} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-gray-800">
                      {stepOk(i) ? <IoCheckmarkCircle className="text-emerald-500" /> : <IoAlertCircle className="text-rose-500" />}
                      {s.label}
                    </span>
                    {stepOk(i) ? <span className="text-xs text-emerald-700">Ready</span> : <button type="button" onClick={() => { setAttempted((a) => ({ ...a, [i]: true })); setStep(i); }} className="text-xs font-semibold text-rose-600 hover:underline">{Object.values(errors[i])[0]}</button>}
                  </li>
                ))}
              </ul>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Packages buyers will see</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {tiers.map((p, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-baseline justify-between"><span className="font-semibold text-gray-900">{p.name}</span><span className="font-display text-xl font-bold">${Number(p.price) || 0}</span></div>
                      <p className="mt-1 text-xs text-gray-500">{p.description || "—"}</p>
                      <div className="mt-2 flex gap-3 text-xs text-gray-600"><span className="inline-flex items-center gap-1"><IoTimeOutline />{p.deliveryDate} days</span><span className="inline-flex items-center gap-1"><IoRefreshOutline />{p.revisions === "" ? "On request" : `${p.revisions} revisions`}</span></div>
                      <ul className="mt-2 space-y-1 text-xs text-gray-700">{p.features.filter((f) => f.trim()).map((f, k) => <li key={k} className="flex gap-1"><IoCheckmarkCircle className="mt-0.5 shrink-0 text-emerald-500" />{f}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-5">
            <button type="button" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40"><IoArrowBack />Back</button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => go(step + 1)} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800">Save &amp; continue<IoArrowForward /></button>
            ) : (
              <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? "Saving…" : mode === "create" ? "Publish gig" : "Save changes"}</button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-24 lg:self-start" data-testid="preview">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Live preview</p>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="aspect-[5/3] bg-gradient-to-br from-emerald-50 to-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover ? <img src={cover} alt="Cover preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-gray-400">Your cover image</div>}
            </div>
            <div className="space-y-2 p-4">
              <p className="line-clamp-2 text-sm font-semibold text-gray-900">{data.title.trim() || "I will …"}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500"><IoStar className="text-amber-400" />New seller</div>
              {data.tags.length > 0 && <div className="flex flex-wrap gap-1">{data.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{t}</span>)}</div>}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
                <span>{tiers.length} package{tiers.length > 1 ? "s" : ""}</span>
                <span>From <b className="text-base text-gray-900">{Number.isFinite(minPrice) ? `$${minPrice}` : "$—"}</b></span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <tr>
      <th scope="row" className="bg-gray-50/60 p-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</th>
      {children}
    </tr>
  );
}

function ListEditor({ title, hint, items, onChange, empty, render, max }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-gray-200 p-3">
          <div className="grid flex-1 gap-2">{render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}</div>
          <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-rose-600"><IoTrashOutline /></button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, empty])} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"><IoAdd />Add</button>
      )}
    </section>
  );
}

function TagInput({ tags, onChange, err }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().toLowerCase().replace(/,$/, "").slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 5) onChange([...tags, t]);
    setText("");
  };
  return (
    <Field label="Search tags" hint="Up to 5 keywords buyers would search for. Press Enter or comma to add." err={err} right={<span className="text-xs text-gray-400">{tags.length}/5</span>}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-emerald-100">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><IoClose /></button>
          </span>
        ))}
        <input
          value={text}
          disabled={tags.length >= 5}
          onChange={(e) => {
            const v = e.target.value;
            if (!v.includes(",")) return setText(v);
            const parts = v.split(",").map((x) => x.trim().toLowerCase().slice(0, 30)).filter(Boolean);
            const last = v.endsWith(",") ? "" : parts.pop() || "";
            onChange([...new Set([...tags, ...parts])].slice(0, 5));
            setText(last);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !text && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={add}
          placeholder={tags.length >= 5 ? "Maximum reached" : "e.g. landing page"}
          className="min-w-[140px] flex-1 border-0 text-sm outline-none"
        />
      </div>
    </Field>
  );
}
