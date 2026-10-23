"use client";
import JobSuccessBadge from "@/components/common/JobSuccessBadge";
// "Get to know the seller" section card on the gig detail page.
//
// The "Contact me" button now opens the shared ContactSellerModal (the
// same modal the right-rail package picker uses), so there's a single
// Fiverr-style flow: click → type message → Send → land in /inbox with
// the chat already open and the gig referenced.

import { useState } from "react";
import moment from "moment";
import { IoStar, IoChatbubbleEllipsesOutline } from "react-icons/io5";

import { useGetFreelancerStatsQuery } from "@/app/redux/features/getFreelancerStats";
import useUser from "@/hooks/useUser";
import Avatar from "@/components/common/Avatar";
import ContactSellerModal from "./ContactSellerModal";

function formatResponseTime(minutes) {
  if (!minutes) return "—";
  const d = moment.duration(minutes, "minutes");
  if (minutes < 60) return `${d.minutes()} min`;
  if (minutes < 1440) return `${d.hours()} hr`;
  return `${d.days()} day${d.days() === 1 ? "" : "s"}`;
}

export default function AboutCard({ gig, user, hideActions = false }) {
  const loginUser = useUser();
  const [open, setOpen] = useState(false);
  const { data: stats } = useGetFreelancerStatsQuery(user?.id, {
    skip: !user?.id,
  });

  const averageResponseTime = formatResponseTime(stats?.averageResponseTime);
  const totalOrders = stats?.totalOrders || 0;
  const memberSince = user?.createdAt
    ? moment(user.createdAt).format("MMM YYYY")
    : "—";

  const isMyOwn = loginUser?.id && (loginUser.id === user?.id || loginUser._id === user?._id);

  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold text-gray-900">
        Get to know the seller
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <Avatar src={user?.image} name={user?.fullName} size={64} rounded />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-gray-900 truncate">
            {user?.fullName}
            {user?.online && (
              <span className="ml-2 align-middle inline-block w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {user?.intro || "Qwlee seller"}
          </div>
          {user?.review?.total > 0 ? (
            <div className="inline-flex items-center gap-1 text-sm mt-0.5">
              <IoStar className="text-amber-500" />
              <span className="font-semibold text-gray-900">
                {Number(user.review.rating).toFixed(1)}
              </span>
              <span className="text-gray-500">({user.review.total})</span>
            </div>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <JobSuccessBadge userId={user?.id || user?._id} />
            {user?.planBadge ? (
              <span data-testid="plan-badge" className="inline-flex items-center px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800 text-xs font-semibold">
                {user.planBadge === "premium" ? "Premium seller" : "Plus seller"}
              </span>
            ) : null}
          </div>
        </div>
        {!hideActions && !isMyOwn && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <IoChatbubbleEllipsesOutline /> Contact me
          </button>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <Stat label="From" value={user?.location || "—"} />
        <Stat label="Member since" value={memberSince} />
        <Stat label="Avg. response" value={averageResponseTime} />
        <Stat label="Languages" value={user?.language || "—"} />
        <Stat label="Last delivery" value={`${totalOrders} orders`} />
        <Stat
          label="Hourly rate"
          value={user?.perHourRate ? `$${user.perHourRate}/hr` : "—"}
        />
      </dl>

      {user?.about && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {user.about}
          </p>
        </div>
      )}

      <ContactSellerModal
        open={open}
        onClose={() => setOpen(false)}
        seller={user}
        gig={gig}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-gray-900 mt-1">{value}</dd>
    </div>
  );
}
