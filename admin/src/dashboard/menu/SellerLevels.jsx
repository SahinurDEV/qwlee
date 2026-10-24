// /dashboard/seller-levels — admin control panel for the Fiverr-style
// seller level system. Two sections:
//   • Tier thresholds editor (global). Edit minOrders / minClients /
//     minEarnings / minRating per tier. Add / remove tiers entirely.
//     Persisted to AppConfig.sellerLevels and read live by the seller
//     dashboard's level overview.
//   • Sellers table — every freelancer with their computed tier vs
//     effective tier (which differs only when an admin override is
//     set). Click Override to pin/clear a seller's level with a reason.

import { useEffect, useMemo, useState } from "react";
import {
  IoSearch,
  IoTrophyOutline,
  IoAddCircleOutline,
  IoTrashOutline,
  IoClose,
  IoCheckmarkCircle,
  IoFlash,
} from "react-icons/io5";
import toast from "react-hot-toast";

import {
  useGetSellerLevelsQuery,
  useGetLevelTiersQuery,
  useUpdateLevelTiersMutation,
  useSetLevelOverrideMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Avatar from "../../common/Avatar";
import cls from "../../utils/cls";
import { adminFetch } from "../../utils/adminApi";
import { formatMoney, formatNumber } from "../../utils/format";

export default function SellerLevels() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Seller levels"
        subtitle="Configure the Fiverr-style level system: edit tier thresholds, or pin a seller to a specific tier."
      />

      <TierEditor />
      <SellersTable />
    </div>
  );
}

// -- Tier editor -----------------------------------------------------------
function TierEditor() {
  const { data: live, isFetching } = useGetLevelTiersQuery();
  const [updateTiers, { isLoading }] = useUpdateLevelTiersMutation();
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    if (Array.isArray(live) && live.length > 0) setTiers(live);
  }, [live]);

  function patch(i, key, value) {
    setTiers((arr) =>
      arr.map((t, idx) => (idx === i ? { ...t, [key]: value } : t))
    );
  }

  function addTier() {
    setTiers((arr) => [
      ...arr,
      {
        id: `tier${arr.length}`,
        label: "New tier",
        minOrders: 0,
        minClients: 0,
        minEarnings: 0,
        minRating: 0,
        minResponseRate: 0,
        minSuccessScore: 0,
        requiresApproval: false,
      },
    ]);
  }

  function removeTier(i) {
    setTiers((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (tiers.length === 0) {
      toast.error("Keep at least one tier.");
      return;
    }
    const res = await updateTiers(tiers);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not save tiers");
      return;
    }
    toast.success("Tier ladder updated");
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
          <IoTrophyOutline className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-900">
            Tier thresholds
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            A seller earns the highest tier whose all four conditions they
            satisfy. Edit, add, or remove tiers — the seller dashboard
            updates on the next load.
          </p>
        </div>
        <button
          type="button"
          onClick={addTier}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 text-sm text-ink-700 hover:bg-ink-50"
        >
          <IoAddCircleOutline /> Add tier
        </button>
      </div>

      {isFetching && tiers.length === 0 ? (
        <div className="py-6 text-sm text-ink-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">ID</th>
                <th className="text-left px-3 py-2 font-semibold">Label</th>
                <th className="text-right px-3 py-2 font-semibold">Orders ≥</th>
                <th className="text-right px-3 py-2 font-semibold">Clients ≥</th>
                <th className="text-right px-3 py-2 font-semibold">Earnings ≥</th>
                <th className="text-right px-3 py-2 font-semibold">Rating ≥</th>
                <th className="text-right px-3 py-2 font-semibold">Response % ≥</th>
                <th className="text-right px-3 py-2 font-semibold">Success ≥</th>
                <th className="text-center px-3 py-2 font-semibold">Approval</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {tiers.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input
                      value={t.id}
                      onChange={(e) => patch(i, "id", e.target.value)}
                      className="w-28 px-2 py-1.5 rounded border border-ink-200 text-sm font-mono outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={t.label}
                      onChange={(e) => patch(i, "label", e.target.value)}
                      className="w-48 px-2 py-1.5 rounded border border-ink-200 text-sm outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={t.minOrders ?? 0}
                      onChange={(e) =>
                        patch(i, "minOrders", Number(e.target.value) || 0)
                      }
                      className="w-20 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={t.minClients ?? 0}
                      onChange={(e) =>
                        patch(i, "minClients", Number(e.target.value) || 0)
                      }
                      className="w-20 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={t.minEarnings ?? 0}
                      onChange={(e) =>
                        patch(i, "minEarnings", Number(e.target.value) || 0)
                      }
                      className="w-24 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.1"
                      value={t.minRating ?? 0}
                      onChange={(e) =>
                        patch(i, "minRating", Number(e.target.value) || 0)
                      }
                      className="w-20 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} max={100} aria-label="Minimum response rate" value={t.minResponseRate ?? 0} onChange={(e) => patch(i, "minResponseRate", Number(e.target.value) || 0)} className="w-20 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} max={10} aria-label="Minimum success score" title="Success Score 1–10, 0 = not required. Sellers without a score yet are not held back." value={t.minSuccessScore ?? 0} onChange={(e) => patch(i, "minSuccessScore", Number(e.target.value) || 0)} className="w-20 px-2 py-1.5 rounded border border-ink-200 text-sm text-right outline-none focus:border-primary-400" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" aria-label="Requires admin approval" checked={!!t.requiresApproval} onChange={(e) => patch(i, "requiresApproval", e.target.checked)} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="p-1.5 rounded text-rose-600 hover:bg-rose-50"
                      title="Remove tier"
                    >
                      <IoTrashOutline />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end mt-4 pt-3 border-t border-ink-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
        >
          {isLoading ? "Saving…" : "Save tier ladder"}
        </button>
      </div>
    </Card>
  );
}

// -- Sellers table ---------------------------------------------------------
function SellersTable() {
  const [search, setSearch] = useState("");
  const { data: sellers = [], isFetching, refetch: refetchSellers } = useGetSellerLevelsQuery({});
  const { data: tiers = [] } = useGetLevelTiersQuery();
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [, bump] = useState(0);
  async function reviewTopRated(s, action) {
    if (action !== "approve" && !confirm("Remove this seller's Top Rated approval?")) return;
    try {
      await adminFetch(`/admin/seller-levels/${s._id}/top-rated`, { method: "POST", body: { action } });
      toast.success(action === "approve" ? "Top Rated approved" : "Top Rated removed");
      refetchSellers?.();
      bump((n) => n + 1);
    } catch (e) {
      toast.error(e.message);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s) =>
      [s.fullName, s.username, s.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [sellers, search]);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
          <IoFlash className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-900">Sellers</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Computed level is what the seller would earn from their metrics
            today. Effective level is what they actually see — only differs
            when an admin override is active.
          </p>
        </div>
      </div>

      <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 max-w-sm w-full focus-within:border-primary mb-4">
        <IoSearch className="text-ink-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Seller</th>
              <th className="text-left px-3 py-2 font-semibold">Computed</th>
              <th className="text-left px-3 py-2 font-semibold">Effective</th>
              <th className="text-right px-3 py-2 font-semibold">Orders</th>
              <th className="text-right px-3 py-2 font-semibold">Clients</th>
              <th className="text-right px-3 py-2 font-semibold">Earnings</th>
              <th className="text-right px-3 py-2 font-semibold">Rating</th>
              <th className="text-right px-3 py-2 font-semibold" title="Success Score 1–10">Success</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {isFetching && visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-500">
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-500">
                  No sellers match this view.
                </td>
              </tr>
            ) : (
              visible.map((s) => {
                const overridden = !!s.overrideTierId;
                return (
                  <tr key={s._id} className="hover:bg-ink-50/60">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={s.image}
                          name={s.fullName}
                          size={32}
                          rounded
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-ink-900 font-medium truncate">
                            {s.fullName}
                          </div>
                          <div className="text-xs text-ink-500 truncate">
                            {s.username ? `@${s.username}` : s.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {s.computedTierLabel}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cls(
                          "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
                          overridden
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {overridden && <IoFlash className="w-3 h-3" />}
                        {s.effectiveTierLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(s.stats?.completedOrders)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(s.stats?.uniqueClients)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(s.stats?.earnings)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(s.rating || 0).toFixed(1)}
                      <span className="text-ink-400">
                        {" "}
                        ({s.reviews || 0})
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums" title={s.stats?.success ? `${s.stats.success.orders} orders in ${s.stats.success.windowDays} days` : ""}>
                      {s.stats?.successScore != null ? `${s.stats.successScore}/10` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {s.topRated?.eligible && s.topRated.status !== "approved" ? (
                        <button type="button" onClick={() => reviewTopRated(s, "approve")} className="mr-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                          Approve Top Rated{s.topRated.status === "declined" ? " (declined)" : ""}
                        </button>
                      ) : null}
                      {s.topRated?.status === "approved" ? (
                        <button type="button" onClick={() => reviewTopRated(s, "reset")} className="mr-3 text-xs font-semibold text-rose-600 hover:text-rose-700">
                          Remove Top Rated
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOverrideTarget(s)}
                        className="text-xs font-semibold text-primary-700 hover:text-primary-800"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <OverrideModal
        seller={overrideTarget}
        tiers={tiers}
        onClose={() => setOverrideTarget(null)}
      />
    </Card>
  );
}

// -- Override modal --------------------------------------------------------
function OverrideModal({ seller, tiers, onClose }) {
  const [tierId, setTierId] = useState("");
  const [reason, setReason] = useState("");
  const [setLevelOverride, { isLoading }] = useSetLevelOverrideMutation();

  useEffect(() => {
    if (seller) {
      setTierId(seller.overrideTierId || "");
      setReason(seller.overrideReason || "");
    }
  }, [seller]);

  if (!seller) return null;

  async function handleSubmit(clear = false) {
    const res = await setLevelOverride({
      userId: seller._id,
      tierId: clear ? "" : tierId,
      reason: clear ? "" : reason.trim(),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not set override");
      return;
    }
    toast.success(clear ? "Override cleared" : "Level override saved");
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
          <h2 className="text-base font-semibold text-ink-900">
            Override level for {seller.fullName}
          </h2>
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
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 text-xs">
            <div className="text-ink-500">Currently computed:</div>
            <div className="font-semibold text-ink-900 mt-0.5">
              {seller.computedTierLabel}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
              Pin to tier
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTierId("")}
                className={cls(
                  "px-3 py-1.5 rounded-full text-xs font-medium border",
                  tierId === ""
                    ? "bg-primary-50 border-primary-300 text-primary-800"
                    : "bg-white border-ink-200 text-ink-700 hover:border-ink-300"
                )}
              >
                No override (computed)
              </button>
              {tiers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTierId(t.id)}
                  className={cls(
                    "px-3 py-1.5 rounded-full text-xs font-medium border",
                    tierId === t.id
                      ? "bg-primary-50 border-primary-300 text-primary-800"
                      : "bg-white border-ink-200 text-ink-700 hover:border-ink-300"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
              Reason (optional)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Why is this seller pinned to a specific tier?"
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400 resize-none"
            />
            <div className="text-right text-xs text-ink-400 mt-1">
              {reason.length}/500
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-ink-100 flex items-center justify-between gap-2">
          {seller.overrideTierId ? (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isLoading}
              className="text-xs font-medium text-rose-700 hover:text-rose-800"
            >
              Clear override
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
            >
              <IoCheckmarkCircle className="w-4 h-4" />
              {isLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
