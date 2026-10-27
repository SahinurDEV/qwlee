// /dashboard/disputes — admin dispute queue + resolution panel + AI assistant.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  IoFlagOutline,
  IoSearch,
  IoCheckmarkCircle,
  IoSparklesOutline,
  IoCopyOutline,
  IoCloseCircle,
} from "react-icons/io5";

import {
  useGetAdminDisputesQuery,
  useGetDisputeDetailQuery,
  useResolveDisputeMutation,
  useGetDisputeAiStatusQuery,
  useSuggestDisputeAiMutation,
  useFeedbackDisputeAiMutation,
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

const OUTCOME_LABEL = {
  full_refund: "Full refund",
  partial_refund: "Partial refund",
  release_to_seller: "Release to seller",
  mutual_cancellation: "Mutual cancellation",
  ask_for_more_info: "Ask for more info",
};

function policyHref(source) {
  // policy:refund§5 → /refund-policy#s5
  const m = String(source || "").match(/^policy:([^§]+)§(\d+)$/);
  if (!m) return null;
  const doc = m[1];
  const map = {
    refund: "/refund-policy",
    "payment-terms": "/payment-terms",
    "community-standards": "/community-standards",
    "intellectual-property": "/intellectual-property",
    "terms-excerpt": "/terms-of-service",
  };
  const base = map[doc];
  return base ? `${base}#s${m[2]}` : null;
}

export default function Disputes() {
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [note, setNote] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionMeta, setSuggestionMeta] = useState(null);

  const { data, isFetching } = useGetAdminDisputesQuery({ status: tab || undefined });
  const items = data?.results || [];
  const [resolve, { isLoading: resolving }] = useResolveDisputeMutation();
  const { data: aiStatus } = useGetDisputeAiStatusQuery();
  const [suggestAi, { isLoading: suggesting }] = useSuggestDisputeAiMutation();
  const [feedbackAi] = useFeedbackDisputeAiMutation();

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
    if (resolution === "partial_refund") {
      const amt = Number(partialAmount);
      if (!Number.isFinite(amt) || amt < 0) {
        toast.error("Enter a valid partial refund amount");
        return;
      }
    }
    if (!confirm(`Resolve as "${resolution.replace(/_/g, " ")}"?`)) return;
    const res = await resolve({
      disputeId: dispute._id || dispute.id,
      resolution,
      resolutionNote: note,
      partialAmount: resolution === "partial_refund" ? partialAmount : undefined,
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't resolve");
      return;
    }
    if (suggestionMeta?.suggestionId) {
      await feedbackAi({
        disputeId: dispute._id || dispute.id,
        suggestionId: suggestionMeta.suggestionId,
        action: suggestion?.outcome === resolution ? "accept" : "edit",
        outcome: resolution,
        note,
        amount: resolution === "partial_refund" ? Number(partialAmount) : undefined,
      });
    }
    toast.success("Dispute resolved");
    setNote("");
    setPartialAmount("");
    setSuggestion(null);
    setSuggestionMeta(null);
  }

  async function handleSuggest() {
    if (!dispute) return;
    setSuggestion(null);
    setSuggestionMeta(null);
    const res = await suggestAi({ disputeId: dispute._id || dispute.id });
    if (res?.error) {
      const msg = res.error?.data?.message || res.error?.error || "AI suggestion failed";
      toast.error(msg);
      return;
    }
    const data = res?.data;
    setSuggestion(data?.suggestion || null);
    setSuggestionMeta(data || null);
    if (data?.suggestion?.outcome && data.suggestion.outcome !== "ask_for_more_info") {
      // Prefill note / amount but do not auto-resolve
      if (data.suggestion.draftNoteToParties) setNote(data.suggestion.draftNoteToParties);
      if (data.suggestion.partial?.amount != null) setPartialAmount(String(data.suggestion.partial.amount));
    }
  }

  async function handleDismissSuggestion() {
    if (suggestionMeta?.suggestionId && dispute) {
      await feedbackAi({
        disputeId: dispute._id || dispute.id,
        suggestionId: suggestionMeta.suggestionId,
        action: "dismiss",
      });
    }
    setSuggestion(null);
    setSuggestionMeta(null);
  }

  function applyAskMoreDraft() {
    const text = suggestion?.draftAskMoreInfo || suggestion?.draftNoteToParties || "";
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Draft copied — paste it into an admin response"),
      () => toast.error("Couldn't copy")
    );
  }

  const counts = useMemo(() => {
    const c = { open: 0, awaiting_response: 0, escalated: 0, resolved: 0 };
    items.forEach((d) => {
      if (c[d.status] != null) c[d.status] += 1;
    });
    return c;
  }, [items]);

  const aiConfigured = aiStatus?.configured;
  const lowConf = suggestion && Number(suggestion.confidence) < 0.55;

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
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1 min-w-0"
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
                    setSuggestion(null);
                    setSuggestionMeta(null);
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
                      onClick={() => {
                        setActiveId(d._id || d.id);
                        setSuggestion(null);
                        setSuggestionMeta(null);
                        setPartialAmount("");
                      }}
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
                      <div className="text-xs text-ink-400">
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
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
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
                <div className="text-left sm:text-right text-xs text-ink-500 shrink-0">
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
                  <div className="mt-1 flex flex-col sm:items-end gap-0.5">
                    <Link
                      className="text-primary-700 underline"
                      to={`/dashboard/conversations?tab=order&order=${dispute?.orderId?._id || dispute?.orderId}`}
                    >
                      Order chat
                    </Link>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 max-h-[40vh] overflow-y-auto space-y-3 bg-ink-50/40">
                {(dispute.responses || []).map((r, i) => (
                  <div
                    key={i}
                    className={cls(
                      "max-w-[95%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                      r.role === "admin"
                        ? "bg-amber-50 border border-amber-200 text-amber-900"
                        : r.role === "freelancer"
                        ? "bg-white border border-ink-200"
                        : "bg-primary-50 border border-primary-100 text-primary-900 sm:ml-auto"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold opacity-70 mb-1 flex-wrap">
                      <span>{r.role}</span>
                      {r?.userId?.fullName || r?.userId?.username ? (
                        <span className="opacity-80 normal-case font-normal">
                          · {r?.userId?.fullName || r?.userId?.username}
                        </span>
                      ) : null}
                      <span className="sm:ml-auto opacity-60 normal-case font-normal">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    {r.proposedResolution ? (
                      <div className="text-xs mb-1 font-semibold">
                        Proposed: {r.proposedResolution.replace(/_/g, " ")}
                      </div>
                    ) : null}
                    {r.message}
                  </div>
                ))}
              </div>

              {dispute.status !== "resolved" ? (
                <div className="p-4 sm:p-5 space-y-3 bg-violet-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-800 flex items-center gap-1.5">
                      <IoSparklesOutline /> AI assistant
                    </h3>
                    <span className="text-[11px] text-ink-500">
                      {aiConfigured
                        ? `Ready · ${aiStatus?.provider || "llm"}`
                        : "AI not configured — set AI_API_KEY"}
                    </span>
                  </div>
                  {!aiConfigured ? (
                    <p className="text-xs text-ink-600">
                      Add an OpenRouter (or other OpenAI-compatible) key as{" "}
                      <code className="text-[11px]">AI_API_KEY</code> and restart the stack.
                      Suggestions never resolve a dispute on their own.
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={suggesting}
                    onClick={handleSuggest}
                    iconLeft={IoSparklesOutline}
                    disabled={!aiConfigured && !aiStatus?.enabled}
                  >
                    Suggest resolution
                  </Button>

                  {suggestion ? (
                    <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
                      {lowConf ? (
                        <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1.5">
                          Low confidence — read the evidence carefully before acting.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">
                          {OUTCOME_LABEL[suggestion.outcome] || suggestion.outcome}
                        </span>
                        <span className="text-xs text-ink-500">
                          {(Number(suggestion.confidence) * 100).toFixed(0)}% confidence
                          {suggestionMeta?.source ? ` · ${suggestionMeta.source}` : ""}
                        </span>
                      </div>
                      <p className="text-sm text-ink-700">{suggestion.rationale}</p>
                      {suggestion.partial?.amount != null ? (
                        <p className="text-xs text-ink-600">
                          Suggested partial amount:{" "}
                          <strong>${Number(suggestion.partial.amount).toFixed(2)}</strong>
                          {suggestion.partial.percent != null
                            ? ` (${suggestion.partial.percent}%)`
                            : ""}
                        </p>
                      ) : null}
                      <ul className="space-y-1.5">
                        {(suggestion.evidence || []).map((e, i) => {
                          const href = policyHref(e.source);
                          return (
                            <li
                              key={i}
                              className="text-xs border border-ink-100 rounded-lg px-2.5 py-2 bg-ink-50/60"
                            >
                              <div className="font-semibold text-ink-700 break-all">
                                {href ? (
                                  <a
                                    className="text-primary-700 underline"
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {e.source}
                                  </a>
                                ) : (
                                  e.source
                                )}
                              </div>
                              <div className="text-ink-600 mt-0.5">“{e.quote}”</div>
                              {e.why ? <div className="text-ink-400 mt-0.5">{e.why}</div> : null}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {suggestion.outcome === "ask_for_more_info" ? (
                          <Button size="sm" variant="secondary" iconLeft={IoCopyOutline} onClick={applyAskMoreDraft}>
                            Copy ask-more draft
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              if (suggestion.outcome === "partial_refund" && suggestion.partial?.amount != null) {
                                setPartialAmount(String(suggestion.partial.amount));
                              }
                              if (suggestion.draftNoteToParties) setNote(suggestion.draftNoteToParties);
                              handleResolve(suggestion.outcome);
                            }}
                          >
                            Accept suggestion
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" iconLeft={IoCloseCircle} onClick={handleDismissSuggestion}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {dispute.status === "resolved" ? (
                <div className="p-4 sm:p-5 bg-primary-50/60">
                  <div className="flex items-center gap-2">
                    <IoCheckmarkCircle className="text-primary-700" />
                    <span className="text-sm font-semibold text-primary-900">
                      Resolved as {String(dispute.resolution || "").replace(/_/g, " ")}
                    </span>
                  </div>
                  {dispute.partialAmount != null ? (
                    <p className="text-xs text-ink-600 mt-1.5">
                      Partial amount: ${Number(dispute.partialAmount).toFixed(2)}
                    </p>
                  ) : null}
                  {dispute.resolutionNote ? (
                    <p className="text-xs text-ink-600 mt-1.5">
                      Note: {dispute.resolutionNote}
                    </p>
                  ) : null}
                  {dispute.resolvedAt ? (
                    <p className="text-xs text-ink-500 mt-1">
                      {formatDate(dispute.resolvedAt)}
                      {dispute?.resolvedByAdminId?.fullName
                        ? ` · ${dispute.resolvedByAdminId.fullName}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 sm:p-5 space-y-3">
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
                  <div>
                    <label className="text-xs text-ink-500 block mb-1">
                      Partial refund amount (USD) — required for partial refund
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="e.g. 40.00"
                      className="w-full max-w-xs rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                  </div>
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
