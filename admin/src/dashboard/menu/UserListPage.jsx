// Shared users list page — drives both /dashboard/frelancer and
// /dashboard/buyerlist. Pulls from RTK Query, applies client-side
// search + status filter + pagination, and renders rows with the
// shared DataTable. Includes a Ban / Unban action — Ban opens a
// reason modal; the saved reason is shown on the user's sign-in
// attempt.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoSearch } from "react-icons/io5";
import { Modal as RModal } from "react-responsive-modal";
import toast from "react-hot-toast";

import { confirmModal } from "../../common/confirm";

import {
  useGetBuyerListQuery,
  useGetFrelancerListQuery,
  useBanUserMutation,
  useUnbanUserMutation,
} from "../../redux/api/apiSlice";
import PageHeader from "../../common/PageHeader";
import DataTable from "../../common/DataTable";
import StatusPill from "../../common/StatusPill";
import Button from "../../common/Button";
import cls from "../../utils/cls";
import { formatDate, formatMoney, timeAgo, truncate } from "../../utils/format";
import getImageUrl from "../../utils/getImageUrl";

import "react-responsive-modal/styles.css";

export default function UserListPage({ role }) {
  const navigate = useNavigate();
  const isFreelancer = role === "freelancer";
  const useQuery = isFreelancer ? useGetFrelancerListQuery : useGetBuyerListQuery;
  const { data, isFetching, isError } = useQuery();

  const users = data?.data?.attributes?.results || [];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | online | offline | banned
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users;
    if (q) {
      list = list.filter((u) =>
        [u.fullName, u.username, u.email, u.location]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      );
    }
    if (status === "online") list = list.filter((u) => u.online);
    if (status === "offline") list = list.filter((u) => !u.online && !u.isBan);
    if (status === "banned") list = list.filter((u) => u.isBan);
    return list;
  }, [users, search, status]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const [banUser, { isLoading: banning }] = useBanUserMutation();
  const [unbanUser, { isLoading: unbanning }] = useUnbanUserMutation();
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState("");

  function openBanModal(u) {
    setBanTarget(u);
    setBanReason("");
  }
  function closeBanModal() {
    setBanTarget(null);
    setBanReason("");
  }
  async function submitBan() {
    if (!banTarget) return;
    const res = await banUser({ userId: banTarget._id || banTarget.id, reason: banReason });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't ban user");
      return;
    }
    toast.success(`${banTarget.fullName} has been banned`);
    closeBanModal();
  }

  async function handleUnban(u) {
    const ok = await confirmModal({
      title: `Unban ${u.fullName}?`,
      description: "They'll be able to sign in again immediately.",
      confirmText: "Unban",
    });
    if (!ok) return;
    const res = await unbanUser(u._id || u.id);
    if (res?.error) toast.error(res.error?.data?.message || "Couldn't unban");
    else toast.success(`${u.fullName} can sign in again`);
  }

  const columns = [
    {
      key: "user",
      label: "User",
      render: (u) => (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="relative">
            <img
              src={getImageUrl(u.image)}
              alt={u.fullName || "user"}
              className="w-9 h-9 rounded-full object-cover bg-ink-100"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
            {u.online && !u.isBan && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink-900 truncate">
              {u.fullName || "Member"}
            </div>
            <div className="text-xs text-ink-500 truncate">
              {u.username ? `@${u.username}` : u.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (u) => (
        <span className="text-ink-700 truncate inline-block max-w-[220px]">
          {truncate(u.email, 36)}
        </span>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (u) => <span className="text-ink-700">{u.location || "—"}</span>,
    },
    isFreelancer
      ? {
          key: "balance",
          label: "Balance",
          render: (u) => (
            <span className="text-ink-900 font-semibold">
              {formatMoney(u.balance)}
            </span>
          ),
        }
      : {
          key: "joined",
          label: "Joined",
          render: (u) => (
            <span className="text-ink-700">{formatDate(u.createdAt)}</span>
          ),
        },
    {
      key: "lastSeen",
      label: "Last seen",
      render: (u) => (
        <span className="text-ink-500 text-xs">
          {u.online ? "Online" : timeAgo(u.lastSeen)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (u) => (
        <div className="flex flex-col gap-0.5">
          <StatusPill
            status={u.isBan ? "rejected" : u.online ? "active" : "muted"}
            label={u.isBan ? "Banned" : u.online ? "Online" : "Offline"}
          />
          {u.isBan && u.banReason ? (
            <span
              title={u.banReason}
              className="text-[10px] text-rose-600 max-w-[180px] truncate"
            >
              {u.banReason}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "action",
      label: "",
      thClassName: "w-[280px]",
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/users/${u._id || u.id}`)}
            className="text-xs font-semibold text-primary-700 hover:text-primary-800 px-2 py-1 rounded-md hover:bg-primary-50"
          >
            Monitor
          </button>
          {/* Admins are never bannable from the UI — backend also
              refuses, but hiding the button keeps the list tidy. */}
          {u.role !== "admin" &&
            (u.isBan ? (
              <button
                type="button"
                disabled={unbanning}
                onClick={() => handleUnban(u)}
                className="text-xs font-semibold text-primary-700 hover:text-primary-800 px-2 py-1 rounded-md hover:bg-primary-50 disabled:opacity-50"
              >
                Unban
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openBanModal(u)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50"
              >
                Ban
              </button>
            ))}
          {u.username ? (
            <a
              href={`http://localhost:8000/${u.username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-ink-500 hover:text-ink-900 px-2 py-1 rounded-md hover:bg-ink-100"
            >
              Public
            </a>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isFreelancer ? "Freelancers" : "Buyers"}
        subtitle={`${visible.length} ${isFreelancer ? "sellers" : "buyers"} match your filters.`}
      />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 max-w-sm w-full focus-within:border-primary">
          <IoSearch className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, username, email, or location…"
            className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
          />
        </div>
        <div className="flex gap-1 bg-white border border-ink-200 rounded-lg p-0.5">
          {[
            { v: "all", label: "All" },
            { v: "online", label: "Online" },
            { v: "offline", label: "Offline" },
            { v: "banned", label: "Banned" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => {
                setStatus(opt.v);
                setPage(1);
              }}
              className={cls(
                "px-3 py-1.5 text-xs font-medium rounded-md transition",
                status === opt.v
                  ? "bg-primary-50 text-primary-800"
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={pageRows}
        loading={isFetching}
        empty={isError ? "Couldn't load users." : "No users match your filters."}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-ink-500">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      <RModal
        open={!!banTarget}
        onClose={closeBanModal}
        center
        classNames={{ modal: "rounded-2xl !p-0 !m-0", overlay: "bg-black/40" }}
      >
        <div className="w-[520px] max-w-[92vw] p-6">
          <h3 className="text-lg font-semibold text-ink-900">
            Ban {banTarget?.fullName}
          </h3>
          <p className="text-sm text-ink-500 mt-1 mb-4">
            They&rsquo;ll be blocked from signing in. The reason below is
            shown on the sign-in screen, so be specific and constructive.
          </p>

          <label className="block text-sm font-medium text-ink-700 mb-1.5">
            Reason
          </label>
          <textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Repeated policy violations: misleading gig descriptions."
            className="w-full px-3 py-2.5 text-sm border border-ink-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary-100 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-ink-400">
              {banReason.length}/500 — leave blank for a generic message.
            </span>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={closeBanModal} type="button">
              Cancel
            </Button>
            <Button variant="danger" onClick={submitBan} loading={banning}>
              Ban user
            </Button>
          </div>
        </div>
      </RModal>
    </div>
  );
}
