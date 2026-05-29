// /dashboard/disputes — admin dispute queue + resolution panel.
//
// Left: list of disputes filtered by status tab.
// Right: full detail of the selected dispute (order + responses) and
// the four resolution options from the PRD §5.10.

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  IoFlagOutline,
  IoSearch,
  IoCheckmarkCircle,
  IoCloseCircle,
} from "react-icons/io5";

import {
  useGetAdminDisputesQuery,
  useGetDisputeDetailQuery,
  useResolveDisputeMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import cls from "../../utils/cls";
import { formatDate, timeAgo } from "../../utils/format";

const TABS = [
  { v: "", label: "All" },
  { v: "open", label: "Open" },
  { v: "awaiting_response", label: "Awaiting response" },
  { v: "escalated", label: "Escalated" },
  { v: "resolved", label: "Resolved" },
];

const REASON_LABEL = {
  not_as_described: "Not as described",
  low_quality: "Low quality",
  late_delivery: "Late delivery",
  no_delivery: "No delivery",
  buyer_unresponsive: "Buyer unresponsive",
  scope_creep: "Scope creep",
  abusive_behavior: "Abusive behavior",
  other: "Other",
};

const RESOLUTION = [
  { value: "full_refund", label: "Full refund to buyer", variant: "danger" },
  { value: "partial_refund", label: "Partial refund", variant: "secondary" },
  { value: "release_to_seller", label: "Release funds to seller", variant: "primary" },
  { value: "mutual_cancellation", label: "Mutual cancellation", variant: "secondary" },
];

export default function Disputes() {
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [note, setNote] = useState("");

  const { data, isFetching } = useGetAdminDisputesQuery({ status: tab || undefined });
  const items = data?.results || [];
  const [resolve, { isLoading: resolving }] = useResolveDisputeMutation();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) =>
      [
        d?.reasonCode,
        d?.status,
        d?.initiatorRole,
        d?.orderId?._id,
        d?.initiatorId?.fullName,
        d?.initiatorId?.username,
        d?.initiatorId?.email,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [items, search]);

  const activeListItem = visible.find((d) => (d._id || d.id) === activeId) || visible[0];
  const activeIdResolved = activeListItem?._id || activeListItem?.id;
  const { data: detail } = useGetDisputeDetailQuery(activeIdResolved, {
    skip: !activeIdResolved,
  });
  const dispute = detail || activeListItem;

  async function handleResolve(resolution) {
    if (!dispute) return;
    if (!confirm(`Resolve as "${resolution.replace(/_/g, " ")}"?`)) return;
    const res = await resolve({
      disputeId: dispute._id || dispute.id,
      resolution,
      resolutionNote: note,
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't resolve");
      return;
    }
    toast.success("Dispute resolved");
    setNote("");
  }

  const counts = useMemo(() => {
    const c = { open: 0, awaiting_response: 0, escalated: 0, resolved: 0 };
    items.forEach((d) => {
      if (c[d.status] != null) c[d.status] += 1;
    });
    return c;
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Disputes"
        subtitle={
          isFetching
            ? "Loading…"
            : `${items.length} dispute${items.length === 1 ? "" : "s"} — ${counts.escalated} escalated.`
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0">
          <div className="p-3 border-b border-ink-100 space-y-2">
            <div className="flex items-center bg-ink-50 border border-ink-200 rounded-lg px-3">
              <IoSearch className="text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by reason, status, user, order…"
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.v || "all"}
                  type="button"
                  onClick={() => {
                    setTab(t.v);
                    setActiveId(null);
                  }}
                  className={cls(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition",
                    tab === t.v
                      ? "bg-primary-50 text-primary-800 border-primary-200"
                      : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="divide-y divide-ink-100 max-h-[70vh] overflow-y-auto">
            {visible.length === 0 ? (
              <li className="p-6 text-sm text-ink-500 text-center">
                {isFetching ? "Loading…" : "No disputes."}
              </li>
            ) : (
              visible.map((d) => {
                const isActive = (d._id || d.id) === (activeListItem?._id || activeListItem?.id);
                return (
                  <li key={d._id || d.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(d._id || d.id)}
                      className={cls(
                        "w-full text-left p-3 transition flex flex-col gap-1.5",
                        isActive ? "bg-primary-50/50" : "hover:bg-ink-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <IoFlagOutline className="text-rose-500 shrink-0" />
                          <span className="text-sm font-semibold text-ink-900 truncate">
                            {REASON_LABEL[d.reasonCode] || d.reasonCode}
                          </span>
                        </div>
                        <StatusPill
                          status={
                            d.status === "resolved"
                              ? "approved"
                              : d.status === "escalated"
                              ? "error"
                              : d.status === "open" || d.status === "awaiting_response"
                              ? "pending"
                              : "muted"
                          }
                          label={d.status.replace(/_/g, " ")}
                        />
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {d.initiatorRole} ·{" "}
                        {d?.initiatorId?.fullName ||
                          d?.initiatorId?.username ||
                          d?.initiatorId?.email ||
                          "User"}
                      </div>
                      <div className="text-[11px] text-ink-400">
                        Opened {timeAgo(d.createdAt)} · order{" "}
                        {String(d?.orderId?._id || d?.orderId || "")
                          .slice(-8)
                          .toUpperCase()}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Card>

        <Card className="lg:col-span-7 xl:col-span-8" bodyClassName="p-0">
          {!dispute ? (
            <div className="p-8 text-center text-ink-500 text-sm">
              Pick a dispute from the list to review.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              <div className="p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-ink-900">
                      {REASON_LABEL[dispute.reasonCode] || dispute.reasonCode}
                    </h2>
                    <StatusPill
                      status={
                        dispute.status === "resolved"
                          ? "approved"
                          : dispute.status === "escalated"
                          ? "error"
                          : "pending"
                      }
                      label={String(dispute.status).replace(/_/g, " ")}
                    />
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    Opened {formatDate(dispute.createdAt)} by{" "}
                    <strong>{dispute.initiatorRole}</strong>{" "}
                    ({dispute?.initiatorId?.fullName ||
                      dispute?.initiatorId?.username ||
                      "user"})
                  </p>
                </div>
                <div className="text-right text-xs text-ink-500">
                  <div>
                    Order #
                    {String(dispute?.orderId?._id || dispute?.orderId || "")
                      .slice(-8)
                      .toUpperCase()}
                  </div>
                  {dispute?.orderId?.price ? (
                    <div className="mt-0.5 font-semibold text-ink-800">
                      ${Number(dispute.orderId.price).toFixed(2)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="p-5 max-h-[55vh] overflow-y-auto space-y-3 bg-ink-50/40">
                {(dispute.responses || []).map((r, i) => (
                  <div
                    key={i}
                    className={cls(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                      r.role === "admin"
                        ? "bg-amber-50 border border-amber-200 text-amber-900"
                        : r.role === "freelancer"
                        ? "bg-white border border-ink-200"
                        : "bg-primary-50 border border-primary-100 text-primary-900 ml-auto"
                    )}
                  >
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold opacity-70 mb-1">
                      <span>{r.role}</span>
                      {r?.userId?.fullName || r?.userId?.username ? (
                        <span className="opacity-80 normal-case font-normal">
                          · {r?.userId?.fullName || r?.userId?.username}
                        </span>
                      ) : null}
                      <span className="ml-auto opacity-60 normal-case font-normal">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    {r.proposedResolution ? (
                      <div className="text-[11px] mb-1 font-semibold">
                        Proposed: {r.proposedResolution.replace(/_/g, " ")}
                      </div>
                    ) : null}
                    {r.message}
                  </div>
                ))}
              </div>

              {dispute.status === "resolved" ? (
                <div className="p-5 bg-primary-50/60">
                  <div className="flex items-center gap-2">
                    <IoCheckmarkCircle className="text-primary-700" />
                    <span className="text-sm font-semibold text-primary-900">
                      Resolved as {String(dispute.resolution || "").replace(/_/g, " ")}
                    </span>
                  </div>
                  {dispute.resolutionNote ? (
                    <p className="text-xs text-ink-600 mt-1.5">
                      Note: {dispute.resolutionNote}
                    </p>
                  ) : null}
                  {dispute.resolvedAt ? (
                    <p className="text-[11px] text-ink-500 mt-1">
                      {formatDate(dispute.resolvedAt)}
                      {dispute?.resolvedByAdminId?.fullName
                        ? ` · ${dispute.resolvedByAdminId.fullName}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Resolve this dispute
                  </h3>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Internal note shown to both parties (optional)"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-primary-500 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {RESOLUTION.map((r) => (
                      <Button
                        key={r.value}
                        variant={r.variant}
                        size="sm"
                        loading={resolving}
                        onClick={() => handleResolve(r.value)}
                        iconLeft={IoCheckmarkCircle}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
