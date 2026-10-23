// /dashboard/verifications — admin reviews seller ID submissions.
//
// Two-pane: pending requests on the left, document preview + decision
// controls on the right.

import { useMemo, useState } from "react";
import { Modal as RModal } from "react-responsive-modal";
import toast from "react-hot-toast";
import {
  IoSearch,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
} from "react-icons/io5";

import {
  useGetVerificationsQuery,
  useReviewVerificationMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import cls from "../../utils/cls";
import { formatDate, timeAgo } from "../../utils/format";
import getImageUrl from "../../utils/getImageUrl";

import "react-responsive-modal/styles.css";

const TABS = [
  { v: "pending", label: "Pending" },
  { v: "approved", label: "Approved" },
  { v: "rejected", label: "Rejected" },
];

export default function Verifications() {
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [zoomImage, setZoomImage] = useState(null);

  const { data, isFetching } = useGetVerificationsQuery(
    { status: tab },
    // ID images are served through signed links that expire after 10
    // minutes, so refresh the list before they lapse.
    { pollingInterval: 5 * 60 * 1000 }
  );
  const items = data?.results || [];
  const [review, { isLoading: reviewing }] = useReviewVerificationMutation();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) =>
      [u.fullName, u.username, u.email]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [items, search]);

  const active = visible.find((u) => (u._id || u.id) === activeId) || visible[0];
  const ver = active?.verification || {};

  async function handleApprove() {
    if (!active) return;
    const res = await review({ userId: active._id || active.id, action: "approve" });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't approve");
      return;
    }
    toast.success(`Approved ${active.fullName}`);
    setActiveId(null);
  }
  async function handleReject() {
    if (!active) return;
    if (!reason.trim()) {
      toast.error("Add a reason so the user knows what to fix.");
      return;
    }
    const res = await review({
      userId: active._id || active.id,
      action: "reject",
      reason,
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't reject");
      return;
    }
    toast.success(`Rejected ${active.fullName}`);
    setRejectOpen(false);
    setReason("");
    setActiveId(null);
  }

  return (
    <div>
      <PageHeader
        title="ID verifications"
        subtitle={`${items.length} ${tab} request${items.length === 1 ? "" : "s"}.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0">
          <div className="p-3 border-b border-ink-100 space-y-2">
            <div className="flex items-center bg-ink-50 border border-ink-200 rounded-lg px-3">
              <IoSearch className="text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, username…"
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
              />
            </div>
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => {
                    setTab(t.v);
                    setActiveId(null);
                  }}
                  className={cls(
                    "px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap",
                    tab === t.v
                      ? "bg-primary-50 text-primary-800"
                      : "text-ink-600 hover:bg-ink-100"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
            {isFetching && visible.length === 0 ? (
              <li className="px-4 py-8 text-sm text-ink-500 text-center">Loading…</li>
            ) : visible.length === 0 ? (
              <li className="px-4 py-8 text-sm text-ink-500 text-center">
                Nothing to review in this view.
              </li>
            ) : (
              visible.map((u) => {
                const id = u._id || u.id;
                const isActive = active && (active._id || active.id) === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(id)}
                      className={cls(
                        "w-full text-left px-4 py-3 flex items-start gap-3 transition",
                        isActive ? "bg-primary-50/60" : "hover:bg-ink-50/60"
                      )}
                    >
                      <img
                        src={getImageUrl(u.image)}
                        alt=""
                        className="w-9 h-9 rounded-full bg-ink-100 object-cover"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink-900 truncate">
                          {u.fullName}
                        </div>
                        <div className="text-xs text-ink-500 truncate">
                          {u.username ? `@${u.username}` : u.email}
                          {" · "}
                          {u.verification?.documentType?.toUpperCase()}
                        </div>
                      </div>
                      <span className="text-xs text-ink-400 whitespace-nowrap">
                        {timeAgo(u.verification?.submittedAt)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Card>

        <Card className="lg:col-span-7 xl:col-span-8">
          {!active ? (
            <div className="px-6 py-12 text-center text-sm text-ink-500">
              Pick a submission on the left to review the documents.
            </div>
          ) : (
            <div>
              {/* User header */}
              <div className="flex items-start gap-4 pb-4 border-b border-ink-100">
                <img
                  src={getImageUrl(active.image)}
                  alt=""
                  className="w-14 h-14 rounded-full bg-ink-100 object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-ink-900 inline-flex items-center gap-2">
                    {active.fullName}
                    {active.isVerified && (
                      <IoShieldCheckmarkOutline className="text-emerald-600" />
                    )}
                  </div>
                  <div className="text-xs text-ink-500">
                    {active.username ? `@${active.username}` : ""}
                    {active.username && active.email ? " · " : ""}
                    {active.email}
                  </div>
                  <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
                    <IoTimeOutline />
                    Submitted {formatDate(ver.submittedAt, { withTime: true })}
                  </div>
                </div>
                <StatusPill
                  status={
                    ver.status === "approved"
                      ? "approved"
                      : ver.status === "rejected"
                      ? "rejected"
                      : ver.status === "pending"
                      ? "pending"
                      : "muted"
                  }
                  label={ver.status}
                />
              </div>

              {/* Doc summary */}
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 text-sm">
                <Field label="Type">
                  {ver.documentType?.toUpperCase() || "—"}
                </Field>
                <Field label="Document number">
                  <span className="font-mono">{ver.documentNumber || "—"}</span>
                </Field>
                <Field label="User role">{active.role}</Field>
              </dl>

              {/* Document previews */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DocPreview label="Front" url={ver.frontUrl} onZoom={setZoomImage} />
                <DocPreview label="Back" url={ver.backUrl} onZoom={setZoomImage} />
                <DocPreview label="Selfie" url={ver.selfieUrl} onZoom={setZoomImage} />
              </div>

              {ver.status === "rejected" && ver.rejectionReason && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-800">
                  <div className="font-semibold">Previous rejection reason</div>
                  <div className="mt-0.5">{ver.rejectionReason}</div>
                </div>
              )}

              {ver.status === "pending" && (
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    variant="danger"
                    iconLeft={IoCloseCircle}
                    onClick={() => {
                      setReason("");
                      setRejectOpen(true);
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    iconLeft={IoCheckmarkCircle}
                    onClick={handleApprove}
                    loading={reviewing}
                  >
                    Approve & verify
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <RModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        center
        classNames={{ modal: "rounded-2xl !p-0 !m-0", overlay: "bg-black/40" }}
      >
        <div className="w-[480px] max-w-[92vw] p-6">
          <h3 className="text-lg font-semibold text-ink-900">
            Reject {active?.fullName}
          </h3>
          <p className="text-sm text-ink-500 mt-1 mb-3">
            The user sees this reason on their profile editor.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Selfie photo is too blurry — please retake in good lighting."
            className="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg outline-none focus:border-primary resize-none"
          />
          <div className="text-xs text-ink-400 mt-1">{reason.length}/500</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setRejectOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReject} loading={reviewing}>
              Reject
            </Button>
          </div>
        </div>
      </RModal>

      <RModal
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        center
        classNames={{ modal: "rounded-2xl !p-0 !m-0 bg-transparent shadow-none", overlay: "bg-black/70" }}
      >
        {zoomImage && (
          <img
            src={zoomImage}
            alt="Document"
            className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-lg"
          />
        )}
      </RModal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400 font-semibold">
        {label}
      </dt>
      <dd className="text-sm text-ink-900 mt-1">{children}</dd>
    </div>
  );
}

function DocPreview({ label, url, onZoom }) {
  if (!url) {
    return (
      <div className="aspect-[4/3] rounded-xl bg-ink-50 border border-dashed border-ink-200 flex items-center justify-center text-xs text-ink-400">
        No {label.toLowerCase()} submitted
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onZoom(url)}
      className="block relative aspect-[4/3] rounded-xl overflow-hidden border border-ink-200 group"
    >
      <img
        src={url}
        alt={label}
        className="w-full h-full object-cover group-hover:scale-105 transition"
      />
      <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-xs font-medium uppercase tracking-wide px-2 py-1">
        {label}
      </span>
    </button>
  );
}
