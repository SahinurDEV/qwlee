"use client";
// /earnings — Fiverr-style earnings dashboard for sellers.
//
// Layout:
//   1. Gradient hero with greeting + lifetime earnings + Withdraw CTA
//   2. Three KPI cards (Available, Pending clearance, Lifetime)
//   3. Recent activity strip — last 6 months net withdrawals (inline SVG)
//   4. Withdrawal history — bespoke table, status pills, empty state
//   5. Withdraw modal — two-column polished form with live balance hint
//
// Pending clearance is computed client-side from the freelancer's
// active+inProgress+delivered orders so the seller can see funds that
// are en route but not yet released. (Backend doesn't surface this
// number explicitly today — keeping it derived avoids a new endpoint.)

import { Modal, Form, Select, Input } from "antd";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IoWalletOutline,
  IoTimerOutline,
  IoTrendingUpOutline,
  IoArrowDownCircleOutline,
  IoCardOutline,
  IoReceiptOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoHourglassOutline,
} from "react-icons/io5";

import useUser from "@/hooks/useUser";
import {
  useGetMyWithdrawalRequestQuery,
  usePostWithdrawalRequestMutation,
} from "@/app/redux/features/withdraw/postWithdrawalRequestApi";
import { useGetUserQuery } from "@/app/redux/features/getSingleUserApi";
import { useGetTotalIncomeFreelancerQuery } from "@/app/redux/features/order/totalIncomeFreelancer";
import { useGetFreelancerAllOrderQuery } from "@/app/redux/features/order/freelancerOrderApi";

const AUSTRALIA_BANKS = [
  "AMP Bank",
  "ANZ",
  "Commonwealth Bank",
  "IMB Bank",
  "ME Bank",
  "NAB",
  "St George Bank",
  "Suncorp Bank",
  "Westpac",
  "Bank of Sydney",
  "Bank Australia",
  "Bank of Melbourne",
  "Bendigo Bank",
  "Macquarie Bank",
  "Bankwest",
  "ING Bank",
];

const ACCOUNT_TYPES = [
  "Savings Account",
  "Checking Account",
  "Business Account",
  "Fixed Deposit Account",
  "Recurring Deposit Account",
];

function money(n) {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_META = {
  Completed: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: IoCheckmarkCircle,
  },
  completed: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: IoCheckmarkCircle,
  },
  Pending: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: IoHourglassOutline,
  },
  pending: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: IoHourglassOutline,
  },
  Failed: {
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: IoCloseCircle,
  },
  Cancelled: {
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: IoCloseCircle,
  },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || {
    cls: "bg-gray-50 text-gray-700 border-gray-200",
    Icon: IoTimerOutline,
  };
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {String(status || "").replace(/^./, (c) => c.toUpperCase())}
    </span>
  );
}

// Tiny inline bar chart for recent withdrawals. Stays paint-cheap and
// avoids pulling in a chart library for one strip.
function MonthlyStrip({ withdrawals }) {
  const buckets = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        total: 0,
      });
    }
    (withdrawals || []).forEach((w) => {
      const t = new Date(w.createdAt);
      const k = `${t.getFullYear()}-${t.getMonth()}`;
      const hit = out.find((b) => b.key === k);
      if (hit) hit.total += Number(w.withdrawalAmount) || 0;
    });
    return out;
  }, [withdrawals]);

  const max = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Last 6 months
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Net withdrawals by month
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
          {money(buckets.reduce((a, b) => a + b.total, 0))}
        </span>
      </div>
      <div className="flex items-end gap-2 h-32">
        {buckets.map((b) => {
          const h = max ? Math.max(4, (b.total / max) * 100) : 4;
          return (
            <div
              key={b.key}
              className="flex-1 flex flex-col items-center gap-1.5"
            >
              <div
                title={`${b.label}: ${money(b.total)}`}
                className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-300 transition-all hover:from-emerald-600 hover:to-emerald-400"
                style={{ height: `${h}%` }}
              />
              <span className="text-[11px] text-gray-500">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Earnings() {
  const user = useUser();
  if (user === undefined) return <main className="bg-gray-50 min-h-screen" aria-busy="true" />;
  if (user.role !== "freelancer") {
    return (
      <main className="bg-gray-50 min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900">Earnings are for sellers</h1>
          <p className="mt-3 text-gray-600">Earnings and withdrawals appear here once you sell services on Qwlee.</p>
          <a href="/dashboard" className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Go to dashboard</a>
        </div>
      </main>
    );
  }
  return <SellerEarnings user={user} />;
}

function SellerEarnings({ user }) {
  const { data: userData } = useGetUserQuery(user?.id, { skip: !user?.id });
  const userTransformData = userData?.data?.attributes?.user;
  const availableBalance = Number(userTransformData?.balance) || 0;
  const displayName =
    userTransformData?.fullName || user?.fullName || "there";

  const { data: totalIncome } = useGetTotalIncomeFreelancerQuery();
  const lifetimeEarnings = Number(totalIncome) || 0;

  const { data: withdrawData, isFetching: withdrawalsLoading } =
    useGetMyWithdrawalRequestQuery();
  const withdrawals = withdrawData?.data?.attributes || [];

  // Derive pending clearance from in-flight orders. We sum delivered +
  // active so the seller sees funds en route but not yet released.
  const { data: activeOrders } = useGetFreelancerAllOrderQuery({
    status: "active",
    limit: 200,
  });
  const { data: deliveredOrders } = useGetFreelancerAllOrderQuery({
    status: "delivered",
    limit: 200,
  });
  const pendingClearance = useMemo(() => {
    const list = [
      ...(activeOrders?.results || []),
      ...(deliveredOrders?.results || []),
    ];
    return list.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  }, [activeOrders, deliveredOrders]);

  const [openModal, setOpenModal] = useState(false);
  const [form] = Form.useForm();
  const [createWithdrawalRequest, { isLoading }] =
    usePostWithdrawalRequestMutation();

  async function handleSubmit(values) {
    if (Number(values.withdrawalAmount) > availableBalance) {
      toast.error("Insufficient balance for withdrawal");
      return;
    }
    try {
      const res = await createWithdrawalRequest(values);
      if (res?.error) {
        toast.error(res.error?.data?.message || "Withdrawal failed");
        return;
      }
      if (res?.data?.code === 201) {
        toast.success("Withdrawal request submitted");
        setOpenModal(false);
        form.resetFields();
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  }

  const canWithdraw = availableBalance > 0;

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Hero header */}
      <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider font-medium text-emerald-100/80">
                Earnings overview
              </div>
              <h1 className="mt-2 text-2xl md:text-4xl font-bold tracking-tight">
                Hello, {displayName} 👋
              </h1>
              <p className="mt-2 text-sm md:text-base text-emerald-50/90 max-w-xl">
                Track your balance, pending clearance, and lifetime
                earnings. Withdraw to your bank in a few clicks.
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="text-xs uppercase tracking-wider text-emerald-100/80">
                Lifetime earnings
              </div>
              <div className="text-3xl md:text-4xl font-bold">
                {money(lifetimeEarnings)}
              </div>
              <button
                onClick={() => setOpenModal(true)}
                disabled={!canWithdraw}
                className="mt-2 inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed font-semibold px-5 py-2.5 rounded-lg shadow-sm transition"
              >
                <IoArrowDownCircleOutline className="w-5 h-5" />
                Withdraw balance
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* KPI cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          <KpiCard
            label="Available for withdrawal"
            value={money(availableBalance)}
            icon={IoWalletOutline}
            tone="emerald"
            hint="Cleared and ready to move to your bank"
          />
          <KpiCard
            label="Pending clearance"
            value={money(pendingClearance)}
            icon={IoTimerOutline}
            tone="amber"
            hint="From active and delivered orders"
          />
          <KpiCard
            label="Lifetime earnings"
            value={money(lifetimeEarnings)}
            icon={IoTrendingUpOutline}
            tone="sky"
            hint="All-time net income on Qwlee"
          />
        </section>

        {/* Chart + tips two-up */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          <div className="lg:col-span-2">
            <MonthlyStrip withdrawals={withdrawals} />
          </div>
          <aside className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Get paid faster
            </h3>
            <ul className="mt-3 space-y-3 text-sm text-gray-700">
              <Tip>
                Deliveries clear in <strong>14 days</strong> once the
                buyer accepts.
              </Tip>
              <Tip>
                Build trust — sellers with{" "}
                <strong>verified IDs</strong> get prioritised payouts.
              </Tip>
              <Tip>
                Need help? Open a{" "}
                <a
                  href="/support"
                  className="text-emerald-700 hover:underline"
                >
                  support ticket
                </a>
                .
              </Tip>
            </ul>
          </aside>
        </section>

        {/* Withdrawals table */}
        <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <header className="px-5 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoReceiptOutline className="text-emerald-700" />
              <h2 className="text-base font-semibold text-gray-900">
                Withdrawal history
              </h2>
            </div>
            <span className="text-xs text-gray-500">
              {withdrawals.length}{" "}
              {withdrawals.length === 1 ? "entry" : "entries"}
            </span>
          </header>

          {withdrawalsLoading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Loading withdrawals…
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState onWithdraw={() => setOpenModal(true)} canWithdraw={canWithdraw} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">
                      Bank
                    </th>
                    <th className="text-left px-5 py-3 font-semibold">
                      Account
                    </th>
                    <th className="text-left px-5 py-3 font-semibold">
                      Type
                    </th>
                    <th className="text-right px-5 py-3 font-semibold">
                      Amount
                    </th>
                    <th className="text-left px-5 py-3 font-semibold">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 font-semibold">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {withdrawals.map((w, idx) => (
                    <tr key={w._id || w.id || idx} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {w.bankName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                        ••••{String(w.accountNumber || "").slice(-4)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {w.accountType}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                        {money(w.withdrawalAmount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={w.status} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                        {fmtDate(w.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Withdraw modal */}
      <Modal
        centered
        open={openModal}
        footer={null}
        onCancel={() => setOpenModal(false)}
        width={520}
        destroyOnClose
        title={null}
        className="rounded-2xl"
      >
        <div className="px-1">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <IoCardOutline className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Withdraw to bank
              </h2>
              <p className="text-xs text-gray-500">
                Available: <strong>{money(availableBalance)}</strong>
              </p>
            </div>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout="vertical"
            className="pt-5"
          >
            <Form.Item
              name="bankName"
              label={<span className="text-sm font-medium text-gray-700">Bank name</span>}
              rules={[{ required: true, message: "Please select your bank" }]}
            >
              <Select
                size="large"
                placeholder="Select your bank"
                options={AUSTRALIA_BANKS.map((b) => ({ label: b, value: b }))}
                showSearch
              />
            </Form.Item>

            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="accountNumber"
                label={<span className="text-sm font-medium text-gray-700">Account number</span>}
                rules={[
                  {
                    required: true,
                    message: "Please enter your account number",
                  },
                ]}
              >
                <Input
                  size="large"
                  type="number"
                  placeholder="0000 0000 0000"
                />
              </Form.Item>
              <Form.Item
                name="accountType"
                label={<span className="text-sm font-medium text-gray-700">Account type</span>}
                rules={[
                  { required: true, message: "Please select account type" },
                ]}
              >
                <Select
                  size="large"
                  placeholder="Select type"
                  options={ACCOUNT_TYPES.map((t) => ({ label: t, value: t }))}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="withdrawalAmount"
              label={
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium text-gray-700">Amount</span>
                  <button
                    type="button"
                    onClick={() =>
                      form.setFieldsValue({ withdrawalAmount: availableBalance })
                    }
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Use max
                  </button>
                </div>
              }
              rules={[
                { required: true, message: "Please enter withdrawal amount" },
              ]}
            >
              <Input
                size="large"
                type="number"
                placeholder="0.00"
                prefix={<span className="text-gray-400">$</span>}
              />
            </Form.Item>

            <div className="text-[11px] text-gray-500 -mt-1 mb-4">
              Funds typically arrive in 2–5 business days. A small bank
              processing fee may apply.
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isLoading ? "Processing…" : "Request withdrawal"}
              </button>
            </div>
          </Form>
        </div>
      </Modal>
    </main>
  );
}

const TONES = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  sky: { bg: "bg-sky-50", text: "text-sky-700" },
};

function KpiCard({ label, value, hint, icon: Icon, tone = "emerald" }) {
  const t = TONES[tone] || TONES.emerald;
  return (
    <article className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6 flex items-start gap-4 transition hover:shadow-sm">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${t.bg} ${t.text}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
          {value}
        </div>
        {hint ? (
          <div className="text-xs text-gray-500 mt-1.5">{hint}</div>
        ) : null}
      </div>
    </article>
  );
}

function Tip({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function EmptyState({ onWithdraw, canWithdraw }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
        <IoReceiptOutline className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No withdrawals yet
      </h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Once you withdraw funds to your bank, your history will appear
        here.
      </p>
      {canWithdraw ? (
        <button
          onClick={onWithdraw}
          className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg"
        >
          <IoArrowDownCircleOutline className="w-4 h-4" />
          Withdraw now
        </button>
      ) : null}
    </div>
  );
}
