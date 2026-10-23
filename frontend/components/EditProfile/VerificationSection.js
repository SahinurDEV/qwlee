"use client";
// Seller verification block on /profile/edit.
//
// Three states cover the whole lifecycle:
//   - unsubmitted / rejected → form to upload (NID or Passport).
//   - pending → "we're reviewing this" banner; form is locked.
//   - approved → ✅ status card with verified date.

import { useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import {
  IoShieldCheckmarkOutline,
  IoCloudUploadOutline,
  IoTimeOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
} from "react-icons/io5";

import { useSubmitVerificationMutation } from "@/app/redux/features/verificationApi";
import { setUser } from "@/app/redux/slices/userSlice";

const TYPES = [
  { v: "nid", label: "National ID (NID)" },
  { v: "passport", label: "Passport" },
];

export default function VerificationSection({ user }) {
  const dispatch = useDispatch();
  const [submit, { isLoading }] = useSubmitVerificationMutation();
  const verification = user?.verification || {};
  const status = verification.status || "unsubmitted";

  const [docType, setDocType] = useState(verification.documentType || "nid");
  const [docNumber, setDocNumber] = useState(verification.documentNumber || "");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [selfie, setSelfie] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!front || !selfie) {
      toast.error("A front photo of the document and a selfie are required.");
      return;
    }
    const fd = new FormData();
    fd.append("documentType", docType);
    if (docNumber) fd.append("documentNumber", docNumber);
    fd.append("front", front);
    if (back) fd.append("back", back);
    fd.append("selfie", selfie);
    const res = await submit(fd);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't submit verification");
      return;
    }
    const next = res?.data?.data?.attributes?.user;
    if (next) {
      Cookies.set("user", JSON.stringify(next));
      dispatch(setUser(next));
    }
    setFront(null);
    setBack(null);
    setSelfie(null);
    toast.success("Documents submitted — our team will review within 24 hours.");
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7 mb-5">
      <header className="mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 inline-flex items-center gap-2">
          <IoShieldCheckmarkOutline className="text-emerald-600" />
          Identity verification
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Get the verified tick mark next to your name. Documents are
          reviewed manually by our team and never shared publicly.
        </p>
      </header>

      {/* State banner */}
      {status === "approved" && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800">
          <IoCheckmarkCircle className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold">Verified</div>
            <p className="text-sm text-emerald-700">
              You&rsquo;re ID-verified — buyers see the verified tick on your
              profile and gigs.
            </p>
          </div>
        </div>
      )}
      {status === "pending" && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
          <IoTimeOutline className="w-5 h-5 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold">Under review</div>
            <p className="text-sm text-amber-700">
              Submitted{" "}
              {verification.submittedAt
                ? new Date(verification.submittedAt).toLocaleString()
                : ""}{" "}
              — we usually respond within 24 hours.
            </p>
          </div>
        </div>
      )}
      {status === "rejected" && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800">
          <IoAlertCircleOutline className="w-5 h-5 mt-0.5 text-rose-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold">Not approved</div>
            <p className="text-sm text-rose-700">
              {verification.rejectionReason ||
                "We couldn't verify your documents. Please resubmit with clearer photos."}
            </p>
          </div>
        </div>
      )}

      {(status === "unsubmitted" || status === "rejected") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                Document type
              </span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500 bg-white"
              >
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                Document number (optional)
              </span>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                maxLength={64}
                placeholder="As printed on the document"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FilePicker
              label={docType === "passport" ? "Passport photo page" : "ID front"}
              file={front}
              onChange={setFront}
              required
            />
            <FilePicker
              label={docType === "passport" ? "Optional back page" : "ID back"}
              file={back}
              onChange={setBack}
            />
            <FilePicker
              label="Selfie with document"
              hint="Hold the document next to your face."
              file={selfie}
              onChange={setSelfie}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? "Uploading…" : status === "rejected" ? "Resubmit for review" : "Submit for review"}
          </button>
          <p className="text-xs text-gray-400">
            By submitting you agree that Qwlee&rsquo;s trust & safety team may
            use these images solely to verify your identity.
          </p>
        </form>
      )}
    </section>
  );
}

function FilePicker({ label, hint, file, onChange, required = false }) {
  const id = `verify-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label
        htmlFor={id}
        className={`block aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer overflow-hidden relative transition ${
          file ? "border-emerald-300" : "border-gray-200 hover:border-emerald-400"
        }`}
      >
        {file ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={URL.createObjectURL(file)}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <IoCloudUploadOutline className="w-6 h-6 mb-1 text-emerald-600" />
            <span className="text-sm font-medium">
              {label}
              {required ? " *" : ""}
            </span>
            {hint && <span className="text-xs text-gray-400 mt-0.5 px-2 text-center">{hint}</span>}
          </div>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-1 text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          Remove
        </button>
      )}
    </div>
  );
}
