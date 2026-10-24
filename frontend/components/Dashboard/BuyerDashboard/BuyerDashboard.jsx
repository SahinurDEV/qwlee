"use client";
// Buyer dashboard — KPIs, recent orders, profile + Become-a-seller in
// the sidebar. Shorter than the freelancer dashboard (no earnings).

import { useMemo } from "react";
import Link from "next/link";
import {
  IoListOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoHeartOutline,
  IoSearchOutline,
} from "react-icons/io5";

import { useGetBuyerAllOrderQuery } from "@/app/redux/features/order/buyerOrderApi";
import useUser from "@/hooks/useUser";
import Avatar from "@/components/common/Avatar";
import Kpi from "@/components/Dashboard/Kpi";
import RecentOrdersTable from "@/components/Dashboard/RecentOrdersTable";
import SavedListsCard from "@/components/Dashboard/BuyerDashboard/SavedListsCard";
import BecomeSellerCta from "@/components/Dashboard/BecomeSellerCta";

export default function BuyerDashboard() {
  const user = useUser();
  const { data: active, isFetching: la } = useGetBuyerAllOrderQuery("active");
  const { data: late, isFetching: ll } = useGetBuyerAllOrderQuery("late");
  const { data: delivered, isFetching: ld } =
    useGetBuyerAllOrderQuery("delivered");
  const { data: cancelled, isFetching: lc } =
    useGetBuyerAllOrderQuery("cancelled");

  const loading = la || ll || ld || lc;
  const activeCount =
    (active?.results?.length || 0) + (late?.results?.length || 0);
  const deliveredCount = delivered?.results?.length || 0;
  const cancelledCount = cancelled?.results?.length || 0;

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

  const fullName = user?.fullName || "Welcome";

  return (
    <main className="container mx-auto px-4 py-8 md:py-10">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back, {fullName.split(" ")[0]}
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            Track your orders and discover new services.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gig"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
          >
            <IoSearchOutline className="w-5 h-5" />
            Browse services
          </Link>
          <Link
            href="/list"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition"
          >
            <IoHeartOutline className="w-5 h-5" />
            Saved
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <Kpi
          icon={IoListOutline}
          label="Active orders"
          value={activeCount}
          tone="sky"
          loading={loading}
        />
        <Kpi
          icon={IoCheckmarkCircleOutline}
          label="Completed"
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <aside className="lg:col-span-1 space-y-5">
          <div
            className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6"
            style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
          >
            <div className="flex items-center gap-4">
              <Avatar
                src={user?.image}
                name={user?.fullName}
                size={64}
                rounded
              />
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {fullName}
                </div>
                {user?.username ? (
                  <div className="text-sm text-gray-500 truncate">
                    @{user.username}
                  </div>
                ) : null}
              </div>
            </div>
            <hr className="my-4 border-gray-100" />
            <ul className="space-y-3 text-sm">
              <Row label="Location" value={user?.location || "—"} />
              <Row label="Languages" value={user?.language || "—"} />
              {user?.about ? (
                <li>
                  <div className="text-gray-500 mb-1">About</div>
                  <p className="text-gray-800 text-sm">{user.about}</p>
                </li>
              ) : null}
            </ul>
            <Link
              href="/profile/edit"
              className="mt-5 inline-flex w-full justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition"
            >
              Edit profile
            </Link>
          </div>

          <SavedListsCard user={user} />
          <BecomeSellerCta user={user} />
        </aside>

        <section className="lg:col-span-2">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent orders</h2>
            <Link
              href="/order"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all →
            </Link>
          </div>
          <RecentOrdersTable
            orders={recent}
            counterpartyLabel="Freelancer"
            counterpartyKey="freelancerId"
            loading={loading && recent.length === 0}
            emptyLabel="No orders yet — browse the marketplace to get started."
          />
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right truncate max-w-[60%]">
        {value}
      </span>
    </li>
  );
}
