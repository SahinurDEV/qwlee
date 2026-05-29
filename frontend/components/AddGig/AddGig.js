"use client";
// Multi-step Qwlee gig creation wizard.
//
// Steps: Overview → Pricing → Description → Gallery & Publish.
// State lives in this component; each step renders its slice and the
// final submit posts the same FormData shape the backend was already
// consuming (title, description, categoriesId, price, images[], package).
//
// Validation happens per-step before "Next" advances. Image upload is
// fully client-side until the final submit, with previews + remove.

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IoArrowBack,
  IoArrowForward,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoCloseCircle,
  IoAddCircleOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { useAddGigMutation } from "@/app/redux/features/addGigApi";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const STEPS = [
  { id: 1, key: "overview", label: "Overview", hint: "Title & category" },
  { id: 2, key: "pricing", label: "Pricing", hint: "Up to 3 packages" },
  { id: 3, key: "description", label: "Description", hint: "Tell buyers more" },
  { id: 4, key: "gallery", label: "Gallery & publish", hint: "Add images, review" },
];

const EMPTY_PACKAGE = {
  name: "",
  price: "",
  deliveryDate: 7,
  features: [{ feature: "" }],
};

// Useful defaults so the form doesn't start empty for the most-common shape.
const DEFAULT_PACKAGES = [
  { name: "Basic", price: "", deliveryDate: 7, features: [{ feature: "" }] },
  { name: "Standard", price: "", deliveryDate: 14, features: [{ feature: "" }] },
  { name: "Premium", price: "", deliveryDate: 21, features: [{ feature: "" }] },
];

export default function AddGig() {
  const router = useRouter();
  const editor = useRef(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // form data
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basicPrice, setBasicPrice] = useState("");
  const [description, setDescription] = useState("");
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  const { data: categoryData } = useGetAllCategoryQuery({});
  const categories = categoryData?.results || [];
  const [setData] = useAddGigMutation();

  // ---- validation per step
  function validateStep(n) {
    const e = {};
    if (n === 1) {
      if (!title.trim() || title.trim().length < 15)
        e.title = "Title should be at least 15 characters";
      if (!categoryId) e.categoryId = "Pick a category";
    }
    if (n === 2) {
      if (!basicPrice || Number(basicPrice) <= 0)
        e.basicPrice = "Enter a starting price";
      packages.forEach((pkg, i) => {
        if (!pkg.name.trim()) e[`pkg-${i}-name`] = "Package name required";
        if (!pkg.price || Number(pkg.price) <= 0)
          e[`pkg-${i}-price`] = "Package price required";
        if (!pkg.deliveryDate || Number(pkg.deliveryDate) < 1)
          e[`pkg-${i}-deliveryDate`] = "Delivery days required";
      });
    }
    if (n === 3) {
      const plain = description.replace(/<[^>]+>/g, "").trim();
      if (plain.length < 50) e.description = "Description must be at least 50 characters";
    }
    if (n === 4) {
      if (images.length === 0) e.images = "Upload at least one image";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
    setErrors({});
  }

  async function publish() {
    if (!validateStep(4)) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description);
      formData.append("categoriesId", categoryId);
      formData.append("price", basicPrice);
      images.forEach((img) => formData.append("images", img));
      // Sanitise packages: drop empty feature rows + numeric coercion.
      const cleanPackages = packages.map((p) => ({
        name: p.name.trim(),
        price: Number(p.price),
        deliveryDate: Number(p.deliveryDate),
        features: (p.features || [])
          .map((f) => ({ feature: (f.feature || "").trim() }))
          .filter((f) => f.feature),
      }));
      formData.append("package", JSON.stringify(cleanPackages));

      const res = await setData(formData).unwrap();
      if (res.code === 201) {
        toast.success("Gig published — it's now live on Qwlee.");
        router.push("/profile");
      }
    } catch (err) {
      toast.error(err?.data?.message || "Could not publish — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- image handlers
  function addImages(files) {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...incoming].slice(0, 6));
  }
  function removeImage(i) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- package handlers
  function updatePackage(i, patch) {
    setPackages((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updateFeature(pkgIdx, fIdx, value) {
    setPackages((prev) =>
      prev.map((p, idx) =>
        idx === pkgIdx
          ? {
              ...p,
              features: p.features.map((f, k) =>
                k === fIdx ? { ...f, feature: value } : f
              ),
            }
          : p
      )
    );
  }
  function addFeature(i) {
    setPackages((prev) =>
      prev.map((p, idx) =>
        idx === i ? { ...p, features: [...p.features, { feature: "" }] } : p
      )
    );
  }
  function removeFeature(pkgIdx, fIdx) {
    setPackages((prev) =>
      prev.map((p, idx) =>
        idx === pkgIdx
          ? { ...p, features: p.features.filter((_, k) => k !== fIdx) }
          : p
      )
    );
  }

  const titleCount = title.trim().length;
  const descPlain = useMemo(
    () => description.replace(/<[^>]+>/g, "").trim().length,
    [description]
  );

  return (
    <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Create a new gig
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Publish a service buyers can order on Qwlee.
        </p>
      </header>

      <Stepper step={step} />

      <section
        className="mt-6 bg-white border border-gray-200 rounded-2xl"
        style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
      >
        <div className="p-5 md:p-8">
          {step === 1 && (
            <Overview
              title={title}
              setTitle={setTitle}
              titleCount={titleCount}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              categories={categories}
              errors={errors}
            />
          )}
          {step === 2 && (
            <Pricing
              basicPrice={basicPrice}
              setBasicPrice={setBasicPrice}
              packages={packages}
              updatePackage={updatePackage}
              updateFeature={updateFeature}
              addFeature={addFeature}
              removeFeature={removeFeature}
              errors={errors}
            />
          )}
          {step === 3 && (
            <Description
              editor={editor}
              description={description}
              setDescription={setDescription}
              descPlain={descPlain}
              errors={errors}
            />
          )}
          {step === 4 && (
            <Gallery
              images={images}
              addImages={addImages}
              removeImage={removeImage}
              errors={errors}
              review={{
                title,
                category: categories.find((c) => c.id === categoryId)?.name,
                basicPrice,
                packages,
                descLength: descPlain,
              }}
            />
          )}
        </div>

        <footer className="px-5 md:px-8 py-4 border-t border-gray-100 flex justify-between items-center">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <IoArrowBack /> Back
          </button>
          <div className="text-sm text-gray-500">
            Step {step} of {STEPS.length}
          </div>
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              Save & continue <IoArrowForward />
            </button>
          ) : (
            <button
              type="button"
              onClick={publish}
              disabled={submitting}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {submitting ? "Publishing…" : "Publish gig"} <IoCheckmarkCircle />
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

/* ---------- Stepper ---------- */

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar">
      {STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isDone = s.id < step;
        return (
          <li
            key={s.id}
            className="flex-1 min-w-[150px] flex items-center gap-2"
          >
            <span
              className={`shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-semibold ${
                isDone
                  ? "bg-emerald-600 text-white"
                  : isActive
                  ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {isDone ? <IoCheckmarkCircle className="w-4 h-4" /> : s.id}
            </span>
            <div className="min-w-0">
              <div
                className={`text-sm font-medium truncate ${
                  isActive ? "text-emerald-700" : "text-gray-800"
                }`}
              >
                {s.label}
              </div>
              <div className="text-xs text-gray-500 truncate">{s.hint}</div>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`hidden md:block flex-1 h-px ${
                  isDone ? "bg-emerald-300" : "bg-gray-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Step 1: Overview ---------- */

function Overview({ title, setTitle, titleCount, categoryId, setCategoryId, categories, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="title">Gig title</Label>
        <div className="text-xs text-gray-500 mb-2">
          A clear, benefit-led title. Start with “I will…” when it fits.
        </div>
        <textarea
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          rows={2}
          placeholder='I will build a modern Next.js website'
          className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-base resize-none"
        />
        <div className="flex items-center justify-between mt-1 text-xs">
          <FieldError msg={errors.title} />
          <span className="text-gray-400">{titleCount}/120</span>
        </div>
      </div>

      <div>
        <Label htmlFor="category">Category</Label>
        <div className="text-xs text-gray-500 mb-2">
          Buyers browse by category — pick the one most relevant to your service.
        </div>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-base bg-white"
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id || c._id} value={c.id || c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError msg={errors.categoryId} />
      </div>
    </div>
  );
}

/* ---------- Step 2: Pricing ---------- */

function Pricing({
  basicPrice,
  setBasicPrice,
  packages,
  updatePackage,
  updateFeature,
  addFeature,
  removeFeature,
  errors,
}) {
  return (
    <div className="space-y-7">
      <div>
        <Label htmlFor="basicPrice">Starting price (USD)</Label>
        <div className="text-xs text-gray-500 mb-2">
          The minimum buyers will pay for the smallest version of your service.
        </div>
        <input
          id="basicPrice"
          type="number"
          min={1}
          value={basicPrice}
          onChange={(e) => setBasicPrice(e.target.value)}
          placeholder="e.g. 50"
          className="w-full max-w-xs px-3 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-base"
        />
        <FieldError msg={errors.basicPrice} />
      </div>

      <div>
        <Label>Packages</Label>
        <div className="text-xs text-gray-500 mb-3">
          Offer up to three tiers. Most buyers anchor on the middle option — make
          it the one you'd most like to sell.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {packages.map((pkg, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 p-4 bg-gray-50/50"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-3">
                Tier {i + 1}
              </div>
              <Field
                label="Package name"
                error={errors[`pkg-${i}-name`]}
              >
                <input
                  value={pkg.name}
                  onChange={(e) => updatePackage(i, { name: e.target.value })}
                  placeholder="e.g. Basic"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm bg-white"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Price (USD)" error={errors[`pkg-${i}-price`]}>
                  <input
                    type="number"
                    min={1}
                    value={pkg.price}
                    onChange={(e) => updatePackage(i, { price: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm bg-white"
                  />
                </Field>
                <Field label="Delivery (days)" error={errors[`pkg-${i}-deliveryDate`]}>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={pkg.deliveryDate}
                    onChange={(e) =>
                      updatePackage(i, { deliveryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm bg-white"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-1.5">
                  What's included
                </div>
                <div className="space-y-2">
                  {pkg.features.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2">
                      <input
                        value={f.feature}
                        onChange={(e) => updateFeature(i, fIdx, e.target.value)}
                        placeholder="e.g. Up to 5 pages"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeFeature(i, fIdx)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label="Remove feature"
                      >
                        <IoCloseCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addFeature(i)}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium hover:text-emerald-800"
                  >
                    <IoAddCircleOutline /> Add feature
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Step 3: Description ---------- */

function Description({ editor, description, setDescription, descPlain, errors }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Detailed description</Label>
        <div className="text-xs text-gray-500 mb-2">
          Cover what's included, what's not, and how you work. Aim for at least
          150 words — buyers scan for specifics.
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <JoditEditor
            ref={editor}
            value={description}
            onChange={(html) => setDescription(html)}
            tabIndex={1}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-xs">
          <FieldError msg={errors.description} />
          <span className="text-gray-400">{descPlain} characters</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step 4: Gallery & publish ---------- */

function Gallery({ images, addImages, removeImage, errors, review }) {
  const inputRef = useRef(null);
  return (
    <div className="space-y-7">
      <div>
        <Label>Gig gallery</Label>
        <div className="text-xs text-gray-500 mb-3">
          Up to 6 images. The first image is the cover — make it count.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((file, i) => (
            <div
              key={i}
              className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-full h-full object-cover"
              />
              {i === 0 && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-2 right-2 bg-white/90 text-red-600 rounded-full w-7 h-7 inline-flex items-center justify-center shadow hover:bg-white"
                aria-label="Remove image"
              >
                <IoTrashOutline className="w-4 h-4" />
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 flex flex-col items-center justify-center text-gray-500 hover:text-emerald-700 transition"
            >
              <IoCloudUploadOutline className="w-7 h-7" />
              <span className="text-xs font-medium mt-1">Add image</span>
            </button>
          )}
        </div>
        <FieldError msg={errors.images} />
      </div>

      {/* Compact review summary so the publisher can sanity-check before posting */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Review before publish
        </div>
        <ul className="text-sm text-gray-800 space-y-1.5">
          <li>
            <span className="text-gray-500">Title:</span>{" "}
            {review.title || <em className="text-gray-400">missing</em>}
          </li>
          <li>
            <span className="text-gray-500">Category:</span>{" "}
            {review.category || <em className="text-gray-400">missing</em>}
          </li>
          <li>
            <span className="text-gray-500">Starting price:</span>{" "}
            {review.basicPrice ? `$${review.basicPrice}` : <em className="text-gray-400">missing</em>}
          </li>
          <li>
            <span className="text-gray-500">Packages:</span>{" "}
            {review.packages.filter((p) => p.name && p.price).length} configured
          </li>
          <li>
            <span className="text-gray-500">Description:</span>{" "}
            {review.descLength >= 50
              ? `${review.descLength} characters`
              : <em className="text-gray-400">too short</em>}
          </li>
          <li>
            <span className="text-gray-500">Images:</span> {images.length}
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ---------- Tiny shared primitives ---------- */

function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold text-gray-900"
    >
      {children}
    </label>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="text-xs text-red-600 mt-1">{msg}</div>;
}
