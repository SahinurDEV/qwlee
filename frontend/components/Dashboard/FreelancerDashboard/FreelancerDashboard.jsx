"use client";
// Freelancer dashboard — KPI strip, recent orders, profile sidebar.
//
// Pulls orders by status from the existing order API and aggregates
// counts + earnings into KPI cards. No new backend endpoints needed.

import { useMemo } from "react";
import Link from "next/link";
import {
  IoListOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCashOutline,
  IoStarOutline,
  IoTimeOutline,
  IoAddCircleOutline,
} from "react-icons/io5";

import { useGetFreelancerAllOrderQuery } from "@/app/redux/features/order/freelancerOrderApi";
import { useGetTotalIncomeFreelancerQuery } from "@/app/redux/features/order/totalIncomeFreelancer";
import useUser from "@/hooks/useUser";
import Avatar from "@/components/common/Avatar";
import Kpi from "@/components/Dashboard/Kpi";
import RecentOrdersTable from "@/components/Dashboard/RecentOrdersTable";
import LevelOverview from "@/components/Dashboard/LevelOverview";
import SellerGigsTable from "@/components/Dashboard/SellerGigsTable";

export default function FreelancerDashboard() {
  const user = useUser();
  const { data: active, isFetching: la } = useGetFreelancerAllOrderQuery("active");
  const { data: late, isFetching: ll } = useGetFreelancerAllOrderQuery("late");
  const { data: delivered, isFetching: ld } =
    useGetFreelancerAllOrderQuery("delivered");
  const { data: cancelled, isFetching: lc } =
    useGetFreelancerAllOrderQuery("cancelled");
  const { data: totalIncome } = useGetTotalIncomeFreelancerQuery();

  const loading = la || ll || ld || lc;

  const activeCount = active?.results?.length || 0;
  const lateCount = late?.results?.length || 0;
  const deliveredCount = delivered?.results?.length || 0;
  const cancelledCount = cancelled?.results?.length || 0;
  const earnings = totalIncome ?? 0;

  // Merge all orders into one list sorted by most recent for the table.
  const recent = useMemo(() => {
    const all = [
      ...(active?.results || []),
      ...(late?.results || []),
      ...(delivered?.results || []),
      ...(cancelled?.results || []),
    ];
    return all
      .filter(Boolean)
      .sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
  }, [active, late, delivered, cancelled]);

  const fullName = user?.fullName || "Freelancer";

  return (
    <main className="container mx-auto px-4 py-8 md:py-10">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back, {fullName.split(" ")[0]}
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            Your gigs, orders, and earnings — all in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gig/add"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
          >
            <IoAddCircleOutline className="w-5 h-5" />
            Create gig
          </Link>
          <Link
            href="/earnings"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition"
          >
            View earnings
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <Kpi
          icon={IoListOutline}
          label="Active orders"
          value={activeCount}
          hint={lateCount > 0 ? `${lateCount} running late` : undefined}
          tone="sky"
          loading={loading}
        />
        <Kpi
          icon={IoCheckmarkCircleOutline}
          label="Delivered"
          value={deliveredCount}
          tone="emerald"
          loading={loading}
        />
        <Kpi
          icon={IoCloseCircleOutline}
          label="Cancelled"
          value={cancelledCount}
          tone="rose"
          loading={loading}
        />
        <Kpi
          icon={IoCashOutline}
          label="Total earnings"
          value={`$${Number(earnings).toLocaleString()}`}
          tone="violet"
          loading={loading}
        />
      </div>

      {/* Fiverr-style level overview — current level, success score,
          rating, response rate, progress bars toward the next level. */}
      <LevelOverview />

      {/* Gigs management with status tabs + per-gig stats table. */}
      <SellerGigsTable />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <aside className="lg:col-span-1 space-y-5">
          <div
            className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6"
            style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
          >
            <div className="flex items-center gap-4">
              <Avatar src={user?.image} name={user?.fullName} size={64} rounded />
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {fullName}
                </div>
                {user?.username ? (
                  <Link
                    href={`/${user.username}`}
                    className="text-sm text-emerald-700 hover:text-emerald-800 truncate inline-block"
                  >
                    @{user.username}
                  </Link>
                ) : null}
              </div>
            </div>
            <hr className="my-4 border-gray-100" />
            <ul className="space-y-3 text-sm">
              <Row
                icon={<IoStarOutline className="w-4 h-4" />}
                label="Rating"
                value={
                  user?.review?.rating
                    ? `${Number(user.review.rating).toFixed(1)} (${
                        user.review?.total || 0
                      })`
                    : "No reviews yet"
                }
              />
              <Row
                icon={<IoTimeOutline className="w-4 h-4" />}
                label="Response time"
                value={user?.responseTime ? `${user.responseTime}h` : "—"}
              />
              <Row label="Hourly rate" value={user?.perHourRate ? `$${user.perHourRate}/hr` : "—"} />
              <Row label="Location" value={user?.location || "—"} />
              <Row label="Languages" value={user?.language || "—"} />
            </ul>
            <Link
              href="/profile/edit"
              className="mt-5 inline-flex w-full justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition"
            >
              Edit profile
            </Link>
          </div>
        </aside>

        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent orders</h2>
            <Link
              href="/order"
              className="inline-flex items-center min-h-[44px] text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all →
            </Link>
          </div>
          <RecentOrdersTable
            orders={recent}
            counterpartyLabel="Client"
            counterpartyKey="clientId"
            loading={loading && recent.length === 0}
            emptyLabel="No orders yet — create a gig to start selling."
          />
        </section>
      </div>
    </main>
  );
}

function Row({ icon, label, value }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-gray-500 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="font-medium text-gray-900 text-right truncate max-w-[60%]">
        {value}
      </span>
    </li>
  );
}
