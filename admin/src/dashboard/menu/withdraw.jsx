// Withdrawals — admin view.
//
// Lists pending / approved / rejected withdrawal requests, lets the
// admin approve or reject inline. Detail drawer shows the full request
// (existing /dashboard/withdrawDetails/:id route).

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoSearch } from "react-icons/io5";
import toast from "react-hot-toast";

import { confirmModal } from "../../common/confirm";

import {
  useGetWithdrawUserQuery,
  useWithdrawCancelByIdMutation,
  useWithdrawPostByIdMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import DataTable from "../../common/DataTable";
import StatusPill from "../../common/StatusPill";
import Kpi from "../../common/Kpi";
import Button from "../../common/Button";
import cls from "../../utils/cls";
import { formatDate, formatMoney } from "../../utils/format";
import getImageUrl from "../../utils/getImageUrl";

export default function Withdraw() {
  const navigate = useNavigate();
  const { data, isFetching, isError } = useGetWithdrawUserQuery();
  const [approve, { isLoading: approving }] = useWithdrawPostByIdMutation();
  const [reject, { isLoading: rejecting }] = useWithdrawCancelByIdMutation();

  const rows = data?.data?.attributes?.results || [];

  const totals = useMemo(() => {
    const out = { pending: 0, approved: 0, rejected: 0, amount: 0 };
    for (const r of rows) {
      const s = (r.status || "pending").toLowerCase();
      if (s === "approved" || s === "completed") out.approved += 1;
      else if (s === "rejected" || s === "cancelled") out.rejected += 1;
      else out.pending += 1;
      if (s !== "rejected" && s !== "cancelled") out.amount += Number(r.amount || 0);
    }
    return out;
  }, [rows]);

  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    let list = rows;
    if (filter !== "all") {
      list = list.filter((r) => {
        const s = (r.status || "pending").toLowerCase();
        if (filter === "approved") return s === "approved" || s === "completed";
        if (filter === "rejected") return s === "rejected" || s === "cancelled";
        return s === filter;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.userId?.fullName, r.userId?.email, r.amount?.toString()]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, filter, search]);

  async function handleApprove(row) {
    const ok = await confirmModal({
      title: `Approve $${row.amount}?`,
      description: "The funds will be flagged as paid out.",
      confirmText: "Approve",
    });
    if (!ok) return;
    const res = await approve(row._id);
    if (res.error) toast.error(res.error?.data?.message || "Could not approve");
    else toast.success("Withdrawal approved");
  }
  async function handleReject(row) {
    const ok = await confirmModal({
      title: "Reject withdrawal?",
      description: "The freelancer will see this request as cancelled.",
      confirmText: "Reject",
      danger: true,
    });
    if (!ok) return;
    const res = await reject(row._id);
    if (res.error) toast.error(res.error?.data?.message || "Could not reject");
    else toast.success("Withdrawal rejected");
  }

  const columns = [
    {
      key: "user",
      label: "Freelancer",
      render: (r) => (
        <div className="flex items-center gap-3">
          <img
            src={getImageUrl(r.userId?.image)}
            alt={r.userId?.fullName || "user"}
            className="w-9 h-9 rounded-full object-cover bg-ink-100"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
          <div>
            <div className="font-medium text-ink-900">{r.userId?.fullName}</div>
            <div className="text-xs text-ink-500">{r.userId?.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => (
        <span className="text-ink-900 font-semibold">{formatMoney(r.amount)}</span>
      ),
    },
    {
      key: "method",
      label: "Method",
      render: (r) => (
        <span className="text-ink-700 capitalize">
          {r.method || r.paymentMethod || "—"}
        </span>
      ),
    },
    {
      key: "requested",
      label: "Requested",
      render: (r) => <span className="text-ink-700">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusPill status={(r.status || "pending").toLowerCase()} />,
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        const s = (r.status || "pending").toLowerCase();
        const closed = s === "approved" || s === "completed" || s === "rejected" || s === "cancelled";
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/withdrawDetails/${r._id}`)}
            >
              Details
            </Button>
            {!closed && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReject(r)}
                  loading={rejecting}
                >
                  Reject
                </Button>
                <Button size="sm" onClick={() => handleApprove(r)} loading={approving}>
                  Approve
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        subtitle="Review and approve freelancer payout requests."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Pending" value={totals.pending} tone="amber" />
        <Kpi label="Approved" value={totals.approved} tone="emerald" />
        <Kpi label="Rejected" value={totals.rejected} tone="rose" />
        <Kpi label="Open amount" value={formatMoney(totals.amount)} tone="sky" />
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 max-w-sm w-full focus-within:border-primary">
          <IoSearch className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by freelancer or amount…"
            className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
          />
        </div>
        <div className="flex gap-1 bg-white border border-ink-200 rounded-lg p-0.5">
          {[
            { v: "pending", label: "Pending" },
            { v: "approved", label: "Approved" },
            { v: "rejected", label: "Rejected" },
            { v: "all", label: "All" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFilter(opt.v)}
              className={cls(
                "px-3 py-1.5 text-xs font-medium rounded-md transition",
                filter === opt.v
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
        rows={visible}
        loading={isFetching}
        empty={isError ? "Couldn't load withdrawals." : "No withdrawal requests in this view."}
      />
    </div>
  );
}
