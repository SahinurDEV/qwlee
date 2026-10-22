"use client";
// Seller vacation mode: while away, gigs leave search results and buyers
// cannot place new orders. Ends automatically on the return date.
import { useState } from "react";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { useUpdateProfileMutation } from "@/app/redux/features/updateProfileApi";
import { setUser } from "@/app/redux/slices/userSlice";
import { isAway } from "@/components/common/AwayBanner";

const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function AvailabilityCard({ user }) {
  const a = user?.availability || {};
  const [away, setAway] = useState(!!a.away);
  const [until, setUntil] = useState(toInput(a.until));
  const [message, setMessage] = useState(a.message || "");
  const [allowMessages, setAllowMessages] = useState(a.allowMessages !== false);
  const [save, { isLoading }] = useUpdateProfileMutation();
  const dispatch = useDispatch();

  async function submit(e) {
    e.preventDefault();
    const res = await save({ availability: { away, until: until ? new Date(`${until}T23:59:59`).toISOString() : null, message, allowMessages } });
    if (res.error) return toast.error(res.error?.data?.message || "Could not save availability");
    const next = res?.data?.data?.attributes;
    if (next) {
      Cookies.set("user", JSON.stringify(next));
      dispatch(setUser(next));
    }
    toast.success(away ? "You're marked as away" : "You're available again");
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7 mt-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
          <p className="text-sm text-gray-500">Going on a break? Your gigs stay visible on your profile but leave search, and buyers can&apos;t order until you&apos;re back.</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isAway(user) ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          {isAway(user) ? "Away" : "Available"}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={away} onChange={(e) => setAway(e.target.checked)} /> I&apos;m unavailable for new orders
      </label>
      {away && (
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            Back on
            <input type="date" value={until} min={toInput(new Date())} onChange={(e) => setUntil(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200" />
          </label>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="checkbox" checked={allowMessages} onChange={(e) => setAllowMessages(e.target.checked)} /> Buyers can still message me
          </label>
          <label className="block text-sm sm:col-span-2">
            Message for buyers
            <input maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="On a short break, back next week!" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200" />
          </label>
        </div>
      )}
      <button disabled={isLoading} className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
        {isLoading ? "Saving…" : "Save availability"}
      </button>
    </form>
  );
}
