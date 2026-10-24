// Gigs — admin view of every gig on the platform.
//
// Adds Fiverr-style moderation: tabs by lifecycle status (active /
// pending / requires-modification / draft / denied / paused), per-row
// status pill, and a one-click "Moderate" modal to flip a gig's
// status with a reason. The reason is shown to the seller on their
// next dashboard load and emailed to them too.

import { useMemo, useState } from "react";
import {
  IoSearch,
  IoClose,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoPauseCircleOutline,
  IoAlertCircleOutline,
  IoEllipsisHorizontal,
  IoTrashOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import toast from "react-hot-toast";

import {
  useGetAdminGigsQuery,
  useUpdateGigStatusMutation,
  useDeleteAdminGigMutation,
  useRestoreAdminGigMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import DataTable from "../../common/DataTable";
import Kpi from "../../common/Kpi";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import cls from "../../utils/cls";
import { formatDate, formatMoney, formatNumber, truncate } from "../../utils/format";
import getImageUrl from "../../utils/getImageUrl";
import { frontendUrl } from "../../baseUrl";
import { act, promptText } from "../control/ui";
import { adminFetch } from "../../utils/adminApi";
import { confirmModal } from "../../common/confirm";
import GigEditModal from "../control/GigEditModal";

const STATUS_TABS = [
  { v: "all", label: "All" },
  { v: "active", label: "Active" },
  { v: "pending", label: "Pending" },
  { v: "requires-modification", label: "Needs changes" },
  { v: "draft", label: "Draft" },
  { v: "denied", label: "Denied" },
  { v: "paused", label: "Paused" },
];

const STATUS_TONE = {
  active: "active",
  pending: "pending",
  "requires-modification": "warning",
  draft: "muted",
  denied: "rejected",
  paused: "muted",
};

const STATUS_LABEL = {
  active: "Active",
  pending: "Pending",
  "requires-modification": "Needs changes",
  draft: "Draft",
  denied: "Denied",
  paused: "Paused",
};

export default function Gigs() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [moderateTarget, setModerateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreGig] = useRestoreAdminGigMutation();

  const { data, isFetching, refetch } = useGetAdminGigsQuery({});
  const [editTarget, setEditTarget] = useState(null);
  const rows = data?.data?.attributes?.results || [];

  const counts = useMemo(() => {
    const out = { all: rows.length };
    for (const t of STATUS_TABS) if (t.v !== "all") out[t.v] = 0;
    for (const g of rows) {
      const s = g.gigStatus || "active";
      if (out[s] != null) out[s] += 1;
    }
    return out;
  }, [rows]);

  const totals = useMemo(() => {
    const out = { count: rows.length, avgPrice: 0 };
    if (rows.length) {
      out.avgPrice = rows.reduce((s, g) => s + Number(g.price || 0), 0) / rows.length;
    }
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (tab !== "all") {
      list = list.filter((g) => (g.gigStatus || "active") === tab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) =>
        [g.title, g.userId?.fullName, g.categoriesId?.name]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, search, tab]);

  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const [picked, setPicked] = useState(() => new Set());
  const gid = (g) => String(g._id || g.id);
  const allPicked = pageRows.length > 0 && pageRows.every((g) => picked.has(gid(g)));
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function bulk(action, status) {
    const ids = [...picked];
    let reason = "";
    if (status === "denied" || status === "requires-modification" || status === "paused") {
      reason = await promptText({ title: `${status === "denied" ? "Deny" : status === "paused" ? "Pause" : "Request changes on"} ${ids.length} gigs`, description: "The note is shown to each seller on their dashboard.", placeholder: "Note for the sellers" });
      if (reason === null) return;
    } else if (!(await confirmModal({ title: `${action === "status" ? `Set ${ids.length} gigs to ${status}` : `${action === "feature" ? "Feature" : "Unfeature"} ${ids.length} gigs`}?`, confirmText: "Confirm" }))) return;
    try {
      const r = await adminFetch("/admin/bulk/gigs", { method: "POST", body: { ids, action, status, reason } });
      toast.success(`${r.modified} gigs updated`);
      setPicked(new Set());
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const columns = [
    {
      key: "pick",
      label: <input type="checkbox" aria-label="Select page" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); pageRows.forEach((g) => (allPicked ? n.delete(gid(g)) : n.add(gid(g)))); return n; })} />,
      render: (g) => <input type="checkbox" aria-label="Select gig" checked={picked.has(gid(g))} onChange={() => toggle(gid(g))} onClick={(e) => e.stopPropagation()} />,
    },
    {
      key: "gig",
      label: "Gig",
      render: (g) => (
        <div className="flex items-center gap-3 min-w-[280px]">
          <div className="w-14 h-10 rounded-md overflow-hidden bg-ink-100 shrink-0">
            <img
              src={getImageUrl(g.images?.[0])}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink-900 truncate max-w-[280px]">
              {truncate(g.title, 60)}
            </div>
            <div className="text-xs text-ink-500">/{g.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "seller",
      label: "Seller",
      render: (g) => (
        <span className="text-ink-700">
          {g.userId?.fullName || "—"}
          {g.userId?.username ? <span className="text-ink-400"> @{g.userId.username}</span> : null}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (g) => <span className="text-ink-700">{g.categoriesId?.name || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (g) => {
        const s = g.gigStatus || "active";
        return (
          <div className="flex flex-col gap-1">
            <StatusPill status={STATUS_TONE[s] || "muted"} label={STATUS_LABEL[s]} />
            {g.moderation?.reason && (s === "denied" || s === "requires-modification") && (
              <span
                className="text-xs text-rose-700 inline-flex items-start gap-1 max-w-[220px]"
                title={g.moderation.reason}
              >
                <IoAlertCircleOutline className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{g.moderation.reason}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "price",
      label: "Starting at",
      render: (g) => (
        <span className="text-ink-900 font-semibold">{formatMoney(g.price)}</span>
      ),
    },
    {
      key: "created",
      label: "Listed",
      render: (g) => <span className="text-ink-700">{formatDate(g.createdAt)}</span>,
    },
    {
      key: "action",
      label: "",
      render: (g) => {
        const removed = !!g.isDeleted;
        return (
          <div className="flex items-center gap-3 justify-end">
            {removed ? (
              <button
                type="button"
                onClick={async () => {
                  const res = await restoreGig(g._id || g.id);
                  if (res?.error) {
                    toast.error(res.error?.data?.message || "Restore failed");
                  } else {
                    toast.success("Gig restored — pending re-approval.");
                  }
                }}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                title="Restore deleted gig"
              >
                <IoRefreshOutline className="w-3.5 h-3.5" />
                Restore
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    act({
                      title: g.featured ? "Remove from featured?" : "Feature this gig?",
                      description: g.featured ? "" : "Featured gigs sort first in search and carry a badge.",
                      path: `/admin/gigs/${g._id || g.id}/feature`,
                      method: "PATCH",
                      body: { featured: !g.featured },
                      success: g.featured ? "Unfeatured" : "Featured",
                      done: () => refetch(),
                    })
                  }
                  className={`text-xs font-medium inline-flex items-center gap-1 ${g.featured ? "text-amber-600" : "text-ink-600 hover:text-ink-900"}`}
                  title="Feature gig"
                  data-testid="feature-gig"
                >
                  {g.featured ? "★ Featured" : "☆ Feature"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTarget(g)}
                  className="text-xs font-medium text-ink-600 hover:text-ink-900 inline-flex items-center gap-1"
                  title="Edit gig"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setModerateTarget(g)}
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 inline-flex items-center gap-1"
                  title="Moderate gig status"
                >
                  <IoEllipsisHorizontal className="w-3.5 h-3.5" />
                  Moderate
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(g)}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                  title="Delete gig"
                >
                  <IoTrashOutline className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            )}
            <a
              href={`${frontendUrl}/gig/${g.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-ink-600 hover:text-ink-900"
            >
              View →
            </a>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gigs"
        subtitle={`${formatNumber(rows.length)} gigs on the marketplace.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Kpi label="Total gigs" value={formatNumber(totals.count)} tone="emerald" />
        <Kpi label="Average starting price" value={formatMoney(totals.avgPrice)} tone="sky" />
        <Kpi label="Matches in view" value={formatNumber(visible.length)} tone="violet" />
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 max-w-sm w-full focus-within:border-primary">
          <IoSearch className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, seller, or category…"
            className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
          />
        </div>

        <div className="flex gap-1 bg-white border border-ink-200 rounded-lg p-0.5 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => {
                setTab(t.v);
                setPage(1);
              }}
              className={cls(
                "px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap",
                tab === t.v
                  ? "bg-primary-50 text-primary-800"
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              {t.label}
              <span className="ml-1 text-xs text-ink-400">{counts[t.v]}</span>
            </button>
          ))}
        </div>
      </div>

      {picked.size ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 text-sm" data-testid="gig-bulk-bar">
          <span className="font-medium">{picked.size} selected</span>
          <Button size="sm" onClick={() => bulk("status", "active")}>Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("status", "requires-modification")}>Request changes</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("status", "paused")}>Pause</Button>
          <Button size="sm" variant="danger" onClick={() => bulk("status", "denied")}>Deny</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("feature")}>Feature</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("unfeature")}>Unfeature</Button>
          <button type="button" className="ml-auto text-xs text-ink-500 underline" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={pageRows}
        loading={isFetching}
        empty="No gigs match this view."
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-ink-500">
            Page {safePage} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      )}

      <ModerateGigModal
        gig={moderateTarget}
        onClose={() => setModerateTarget(null)}
      />
      <DeleteGigModal
        gig={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      {editTarget ? <GigEditModal gig={editTarget} onClose={() => setEditTarget(null)} onSaved={() => refetch()} /> : null}
    </div>
  );
}

// Delete confirmation. Soft-delete by default (gig becomes hidden +
// status flips to paused). Hard delete is gated to gigs with zero
// orders + zero reviews on the backend — we just attempt it and let
// the API tell us if it's not allowed.
function DeleteGigModal({ gig, onClose }) {
  const [reason, setReason] = useState("");
  const [hard, setHard] = useState(false);
  const [deleteGig, { isLoading }] = useDeleteAdminGigMutation();

  if (!gig) return null;

  async function handleConfirm() {
    const res = await deleteGig({
      gigId: gig._id || gig.id,
      hard,
      reason: reason.trim(),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't delete gig");
      return;
    }
    toast.success(hard ? "Gig permanently deleted" : "Gig removed");
    setReason("");
    setHard(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IoTrashOutline className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-semibold text-ink-900">
              Delete gig
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-400 hover:bg-ink-50"
            aria-label="Close"
          >
            <IoClose className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-10 rounded-md overflow-hidden bg-ink-100 shrink-0">
              <img
                src={getImageUrl(gig.images?.[0])}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">
                {gig.title}
              </div>
              <div className="text-xs text-ink-500">
                {gig.userId?.fullName} · /{gig.slug}
              </div>
            </div>
          </div>

          {hard ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-900">
              <strong>Permanent delete:</strong> the gig is wiped from the
              database. Only allowed when there are zero orders and reviews
              referencing it. The seller will lose the gig entirely.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <strong>Soft delete (recommended):</strong> the gig is hidden
              from the marketplace and the seller's dashboard. Order history
              and reviews stay intact for audit. You can restore it any time.
            </div>
          )}

          {!hard && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
                Reason
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder="Why is this gig being removed? Shown to the seller."
                className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400 resize-none"
              />
              <div className="text-right text-xs text-ink-400 mt-1">
                {reason.length}/500
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hard}
              onChange={(e) => setHard(e.target.checked)}
              className="rounded border-ink-300"
            />
            Permanently delete (no order/review history)
          </label>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            Keep gig
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
          >
            <IoTrashOutline className="w-4 h-4" />
            {isLoading ? "Deleting…" : hard ? "Delete permanently" : "Delete gig"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// Gig moderation modal — Fiverr-style. Admin picks a new status from a
// pill row, writes an optional reason (required for denied / requires-
// modification), and submits. The seller gets emailed about the change.
const STATUS_OPTIONS = [
  { v: "active", label: "Active", icon: IoCheckmarkCircleOutline, tone: "emerald" },
  { v: "pending", label: "Pending", icon: IoEllipsisHorizontal, tone: "amber" },
  { v: "requires-modification", label: "Needs changes", icon: IoAlertCircleOutline, tone: "amber" },
  { v: "paused", label: "Paused", icon: IoPauseCircleOutline, tone: "slate" },
  { v: "draft", label: "Draft", icon: IoEllipsisHorizontal, tone: "slate" },
  { v: "denied", label: "Denied", icon: IoCloseCircleOutline, tone: "rose" },
];

// Common reasons for denying or sending back a gig (clicking one fills the note).
const DENY_REASONS = [
  "The title or description doesn't clearly say what the buyer gets.",
  "Images are low quality, misleading or not your own work.",
  "The service is not allowed under our community standards.",
  "The gig is in the wrong category.",
  "Prices or packages are unclear or don't match the description.",
  "The gig asks buyers to contact or pay you outside qwlee.",
  "It copies another seller's gig or uses content you don't own.",
];

function ModerateGigModal({ gig, onClose }) {
  const [status, setStatus] = useState(gig?.gigStatus || "active");
  const [reason, setReason] = useState(gig?.moderation?.reason || "");
  const [updateGigStatus, { isLoading }] = useUpdateGigStatusMutation();

  if (!gig) return null;

  const reasonRequired = status === "denied" || status === "requires-modification";

  async function handleSubmit() {
    if (reasonRequired && !reason.trim()) {
      toast.error("Please tell the seller what needs to change.");
      return;
    }
    const res = await updateGigStatus({
      gigId: gig._id || gig.id,
      status,
      reason: reason.trim(),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't update status");
      return;
    }
    toast.success(`Gig moved to ${STATUS_LABEL[status]}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">Moderate gig</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-400 hover:bg-ink-50"
            aria-label="Close"
          >
            <IoClose className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-10 rounded-md overflow-hidden bg-ink-100 shrink-0">
              <img
                src={getImageUrl(gig.images?.[0])}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">
                {gig.title}
              </div>
              <div className="text-xs text-ink-500">
                {gig.userId?.fullName} · /{gig.slug}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
              New status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setStatus(o.v)}
                  className={cls(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition",
                    status === o.v
                      ? "bg-primary-50 border-primary-300 text-primary-800"
                      : "bg-white border-ink-200 text-ink-700 hover:border-ink-300"
                  )}
                >
                  <o.icon className="w-3.5 h-3.5" />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
              Reviewer notes {reasonRequired && <span className="text-rose-500">*</span>}
            </label>
            {reasonRequired ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {DENY_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason((x) => (x.includes(r) ? x : (x ? x + " " : "") + r).slice(0, 500))} className="text-xs px-2 py-1 rounded-full border border-ink-200 hover:bg-ink-50 text-left">
                    {r}
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder={
                reasonRequired
                  ? "Explain what the seller needs to fix — they'll see this on their dashboard and via email."
                  : "Optional notes for the seller."
              }
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400 resize-none"
            />
            <div className="text-right text-xs text-ink-400 mt-1">
              {reason.length}/500
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
          >
            {isLoading ? "Saving…" : "Update status"}
          </button>
        </footer>
      </div>
    </div>
  );
}
