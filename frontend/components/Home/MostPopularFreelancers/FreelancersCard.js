"use client";
// Compact, modern freelancer card.
// - Click anywhere → /<username> public profile (falls back to legacy
//   freelancer-details if username is missing).
// - Uses the shared Avatar so missing images degrade to initials.
// - Shows real rating from user.review.{rating,total}, real hourly rate,
//   and a small online dot when presence is set.

import LevelBadge from "@/components/common/LevelBadge";
import Link from "next/link";
import { GoDotFill } from "react-icons/go";
import { GiRoundStar } from "react-icons/gi";
import Avatar from "@/components/common/Avatar";

export default function FreelancersCard({ data }) {
  if (!data) return null;
  const {
    fullName,
    username,
    image,
    intro,
    location,
    perHourRate,
    online,
    review,
    skills = [],
  } = data;

  const href = username ? `/${username}` : `/freelancer-details?id=${data.id}`;
  const skillList = Array.isArray(skills)
    ? skills
        .map((s) => (typeof s === "string" ? s : s?.text || s?.name))
        .filter(Boolean)
    : [];

  return (
    // h-full + flex-col makes every card in the row the same height
    // (CSS Grid already stretches rows by default; this opts the card
    // INTO that stretching). The inner body is `flex-1` so the meta
    // footer always sits at the bottom via `mt-auto`.
    <Link
      href={href}
      className="group flex h-full flex-col bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition overflow-hidden"
    >
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar src={image} name={fullName} size={56} rounded />
            {online && (
              <span
                className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 ring-2 ring-white rounded-full w-3.5 h-3.5"
                aria-label="Online"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition">
              {fullName}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
              <LevelBadge seller={{ review }} />
              {username && <span className="text-xs text-gray-500 truncate">@{username}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 text-amber-500 text-sm shrink-0">
            <GiRoundStar />
            <span className="text-gray-900 font-medium">
              {review?.rating ? Number(review.rating).toFixed(1) : "—"}
            </span>
            <span className="text-gray-400 text-xs">
              ({review?.total || 0})
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {intro || "Freelancer on Qwlee."}
        </p>

        {/* Skill chip row always rendered (with a min-height reservation
            even when empty) so cards without skills don't end up
            shorter than cards that have them. */}
        <div className="mt-3 flex flex-wrap gap-1.5 min-h-[1.75rem]">
          {skillList.slice(0, 3).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
            >
              {s}
            </span>
          ))}
          {skillList.length > 3 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              +{skillList.length - 3}
            </span>
          )}
        </div>

        {/* mt-auto pins the meta footer to the bottom of every card,
            regardless of how much intro / skills content sits above. */}
        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-gray-500 truncate min-w-0">
            {online ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <GoDotFill /> Online
              </span>
            ) : (
              <span className="truncate">{location || "—"}</span>
            )}
          </div>
          <div className="text-gray-900 font-semibold shrink-0 ml-2">
            {perHourRate ? `$${perHourRate}/hr` : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
