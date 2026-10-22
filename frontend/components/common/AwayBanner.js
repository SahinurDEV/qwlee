"use client";
import { IoMoonOutline } from "react-icons/io5";

export const isAway = (user) => {
  const a = user?.availability;
  if (!a?.away) return false;
  const now = Date.now();
  if (a.from && new Date(a.from).getTime() > now) return false;
  if (a.until && new Date(a.until).getTime() <= now) return false;
  return true;
};

export default function AwayBanner({ user, className = "" }) {
  if (!isAway(user)) return null;
  const a = user.availability;
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      <IoMoonOutline className="mt-0.5 shrink-0" />
      <div>
        <b>{user.fullName || user.username || "This seller"} is away</b>
        {a.until ? ` until ${new Date(a.until).toLocaleDateString()}` : ""} and isn&apos;t taking new orders.
        {a.message ? <div className="mt-0.5 text-amber-800">“{a.message}”</div> : null}
      </div>
    </div>
  );
}
