"use client";
// Fiverr-style public profile rendered from the user payload returned by
// GET /v1/users/by-username/:username (see backend user.service
// getPublicProfileByUsername — includes gigs, portfolios, reviews).
//
// Stateless on data; only client state is the active tab.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { GoDotFill } from "react-icons/go";
import { GiRoundStar } from "react-icons/gi";
import {
  IoCameraReverseOutline,
  IoCreateOutline,
  IoAddCircleOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { FaSpinner } from "react-icons/fa";

import ImageWithFallback from "@/components/common/ImageWithFallback";
import Avatar from "@/components/common/Avatar";
import VerifiedBadge from "@/components/common/VerifiedBadge";
import ContactButton from "@/components/common/ContactButton";
import useUser from "@/hooks/useUser";
import { useUpdateCoverImageMutation } from "@/app/redux/features/updateProfileApi";
import { setUser } from "@/app/redux/slices/userSlice";

function formatJoined(createdAt) {
  if (!createdAt) return "Recently";
  const d = new Date(createdAt);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function ratingBreakdown(reviews = []) {
  const counts = [0, 0, 0, 0, 0]; // index 0 = 1-star, index 4 = 5-star
  for (const r of reviews) {
    const i = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
    counts[i] += 1;
  }
  const total = reviews.length || 0;
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  const avg = total ? sum / total : 0;
  return { counts, total, avg };
}

const TABS = [
  { id: "about", label: "About" },
  { id: "gigs", label: "Gigs" },
  { id: "portfolio", label: "Portfolio" },
  { id: "reviews", label: "Reviews" },
];

export default function UsernameProfile({ user }) {
  const [tab, setTab] = useState("about");
  const viewer = useUser();
  const dispatch = useDispatch();
  const [updateCoverImage, { isLoading: uploadingCover }] =
    useUpdateCoverImageMutation();
  // Owner detection — compare the resolved user (from the server) against
  // the cookie-stored signed-in user. Either side may carry the id as
  // `id` or `_id` depending on the API serializer.
  const isOwner =
    !!viewer &&
    !!(user._id || user.id) &&
    String(viewer.id || viewer._id) === String(user._id || user.id);
  const [coverImage, setCoverImage] = useState(user.coverImage);

  async function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    const res = await updateCoverImage(formData);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't update cover");
      return;
    }
    const next = res?.data?.data?.attributes;
    if (next) {
      Cookies.set("user", JSON.stringify(next));
      dispatch(setUser(next));
      setCoverImage(next.coverImage);
      toast.success("Cover image updated");
    }
  }

  const { counts, total: totalReviews, avg } = useMemo(
    () => ratingBreakdown(user.reviews),
    [user.reviews]
  );

  const isFreelancer = user.role === "freelancer";

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cover + avatar */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
        <div className="relative h-44 md:h-60 w-full bg-gradient-to-br from-emerald-100 to-teal-200">
          {coverImage ? (
            <ImageWithFallback
              src={coverImage}
              alt={`${user.fullName} cover`}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
            />
          ) : null}
          {isOwner && (
            <>
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <FaSpinner className="animate-spin text-white w-6 h-6" />
                </div>
              )}
              <label
                htmlFor="profile-cover-upload"
                className="absolute right-3 top-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/55 hover:bg-black/70 text-white text-xs font-medium cursor-pointer backdrop-blur-sm"
              >
                <IoCameraReverseOutline />
                Change cover
              </label>
              <input
                id="profile-cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
                disabled={uploadingCover}
              />
            </>
          )}
        </div>
        <div className="px-6 md:px-10 pb-6 -mt-12 md:-mt-16 flex flex-col md:flex-row md:items-end gap-4 md:gap-6 relative">
          <div className="rounded-full ring-4 ring-white bg-white shadow-md">
            <Avatar
              src={user.image}
              name={user.fullName}
              size={120}
              rounded
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-semibold inline-flex items-center gap-2">
                {user.fullName}
                <VerifiedBadge user={user} size={18} title="ID-verified by Qwlee" />
              </h1>
              {user.online ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <GoDotFill /> Online
                </span>
              ) : null}
              {isFreelancer ? (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Seller
                </span>
              ) : (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  Buyer
                </span>
              )}
            </div>
            <div className="text-gray-500 mt-1">@{user.username}</div>
            {user.intro ? (
              <p className="text-gray-700 mt-2 max-w-2xl">{user.intro}</p>
            ) : null}
            <div className="text-sm text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {user.location ? <span>📍 {user.location}</span> : null}
              {user.language ? <span>🗣 {user.language}</span> : null}
              <span>📅 Joined {formatJoined(user.createdAt)}</span>
            </div>
          </div>
          <div className="md:self-end flex flex-wrap items-center gap-2">
            {isOwner ? (
              <>
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                >
                  <IoCreateOutline /> Edit profile
                </Link>
                {isFreelancer && (
                  <Link
                    href="/gig/add"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    <IoAddCircleOutline /> Create a new gig
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
                  title="Open dashboard"
                >
                  <IoSettingsOutline />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>
              </>
            ) : (
              <ContactButton
                receiverId={user._id || user.id}
                redirectBackTo={`/${user.username}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Fiverr-style two-column body: left = tabs/content, right = sticky seller card */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <nav className="border-b border-gray-200 flex gap-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  tab === t.id
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
                {t.id === "gigs" && user.gigs?.length ? (
                  <span className="ml-1.5 text-xs text-gray-400">{user.gigs.length}</span>
                ) : null}
                {t.id === "reviews" && totalReviews ? (
                  <span className="ml-1.5 text-xs text-gray-400">{totalReviews}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mt-6">
            {tab === "about" && <AboutTab user={user} />}
            {tab === "gigs" && <GigsTab gigs={user.gigs || []} sellerUsername={user.username} />}
            {tab === "portfolio" && <PortfolioTab portfolios={user.portfolios || []} />}
            {tab === "reviews" && (
              <ReviewsTab reviews={user.reviews || []} counts={counts} avg={avg} total={totalReviews} />
            )}
          </div>
        </div>

        <aside className="lg:col-span-4">
          {isFreelancer ? (
            <SellerCard
              user={user}
              isOwner={isOwner}
              avg={avg}
              totalReviews={totalReviews}
              joined={formatJoined(user.createdAt)}
            />
          ) : (
            <BuyerCard
              user={user}
              isOwner={isOwner}
              joined={formatJoined(user.createdAt)}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

// Fiverr-style sticky seller card. Renders on the right of the profile
// body on desktop; stacks below the tabs on mobile/tablet.
function SellerCard({ user, isOwner, avg, totalReviews, joined }) {
  return (
    <div className="lg:sticky lg:top-20 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar src={user.image} name={user.fullName} size={56} rounded />
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
              {user.fullName}
              <VerifiedBadge user={user} size={14} />
            </div>
            <div className="text-xs text-gray-500 truncate">@{user.username}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
          {user.online ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
              <GoDotFill /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
              <GoDotFill /> Offline
            </span>
          )}
          {totalReviews > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
              <GiRoundStar /> {avg.toFixed(1)} ({totalReviews})
            </span>
          ) : null}
        </div>
      </div>

      <dl className="divide-y divide-gray-100 border-t border-gray-100">
        <SellerRow label="From">
          {user.gigs?.length
            ? `$${Math.min(...user.gigs.map((g) => Number(g.price) || Infinity))}`
            : "—"}
        </SellerRow>
        <SellerRow label="Member since">{joined}</SellerRow>
        <SellerRow label="Avg. response time">
          {user.responseTime ? `${user.responseTime} hour${user.responseTime === 1 ? "" : "s"}` : "—"}
        </SellerRow>
        <SellerRow label="Languages">{user.language || "—"}</SellerRow>
        <SellerRow label="Location">{user.location || "—"}</SellerRow>
        <SellerRow label="Active gigs">{user.gigs?.length || 0}</SellerRow>
      </dl>

      {!isOwner ? (
        <div className="p-4 border-t border-gray-100 space-y-2">
          <ContactButton
            receiverId={user._id || user.id}
            redirectBackTo={`/${user.username}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          />
          <p className="text-[11px] text-gray-400 text-center">
            Replies typically within {user.responseTime ? `${user.responseTime}h` : "a few hours"}.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function BuyerCard({ user, isOwner, joined }) {
  return (
    <div className="lg:sticky lg:top-20 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="p-5 flex items-center gap-3">
        <Avatar src={user.image} name={user.fullName} size={56} rounded />
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{user.fullName}</div>
          <div className="text-xs text-gray-500 truncate">@{user.username}</div>
        </div>
      </div>
      <dl className="divide-y divide-gray-100 border-t border-gray-100">
        <SellerRow label="Member since">{joined}</SellerRow>
        <SellerRow label="Location">{user.location || "—"}</SellerRow>
        <SellerRow label="Languages">{user.language || "—"}</SellerRow>
      </dl>
      {!isOwner ? (
        <div className="p-4 border-t border-gray-100">
          <ContactButton
            receiverId={user._id || user.id}
            redirectBackTo={`/${user.username}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          />
        </div>
      ) : null}
    </div>
  );
}

function SellerRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 text-right truncate">{children}</dd>
    </div>
  );
}

function AboutTab({ user }) {
  return (
    <section className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-gray-700 whitespace-pre-wrap">
            {user.about || "This seller hasn't written an about section yet."}
          </p>
        </div>
        {user.skills?.length ? (
          <div>
            <h2 className="text-lg font-semibold mb-2">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((s, i) => {
                // Skills may be strings (legacy) or {id, text} objects.
                const text = typeof s === "string" ? s : s?.text || s?.name || "";
                if (!text) return null;
                const key = (typeof s === "object" && s?.id) || `skill-${i}-${text}`;
                return (
                  <span
                    key={key}
                    className="text-sm bg-gray-100 text-gray-800 rounded-full px-3 py-1"
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <aside className="space-y-3 text-sm">
        <Detail label="Languages" value={user.language} />
        <Detail label="Location" value={user.location} />
        <Detail
          label="Rate"
          value={user.perHourRate ? `$${user.perHourRate}/hr` : null}
        />
        <Detail
          label="Response time"
          value={user.responseTime ? `${user.responseTime} hour(s)` : null}
        />
      </aside>
    </section>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function GigsTab({ gigs, sellerUsername }) {
  if (!gigs.length) {
    return <EmptyState message="No gigs yet." />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {gigs.map((g) => (
        <Link
          key={g._id || g.id}
          href={`/gig?id=${g._id || g.id}`}
          className="block rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition"
        >
          <div className="relative w-full aspect-[4/3] bg-gray-100">
            <ImageWithFallback
              src={g.images?.[0]}
              name={g.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          </div>
          <div className="p-4">
            <h3 className="font-medium line-clamp-2">{g.title}</h3>
            <div className="mt-2 text-sm text-gray-500">@{sellerUsername}</div>
            <div className="mt-1 font-semibold">From ${g.price}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function PortfolioTab({ portfolios }) {
  if (!portfolios.length) {
    return <EmptyState message="No portfolio items yet." />;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {portfolios.map((p) => (
        <div
          key={p._id || p.id}
          className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-100"
        >
          <ImageWithFallback
            src={p.image}
            alt="portfolio item"
            fill
            sizes="(max-width: 768px) 50vw, 300px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ reviews, counts, avg, total }) {
  return (
    <section className="grid md:grid-cols-3 gap-6">
      <aside className="md:col-span-1">
        <div className="rounded-xl border border-gray-200 p-4 bg-white">
          <div className="text-3xl font-semibold flex items-center gap-2">
            {avg ? avg.toFixed(2) : "0.00"}
            <GiRoundStar className="text-amber-500" />
          </div>
          <div className="text-sm text-gray-500">{total} review{total === 1 ? "" : "s"}</div>
          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const c = counts[star - 1] || 0;
              const pct = total ? Math.round((c / total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-10 text-right text-gray-500">{star}★</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-500">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
      <div className="md:col-span-2 space-y-3">
        {reviews.length === 0 ? (
          <EmptyState message="No reviews yet." />
        ) : (
          reviews.map((r) => (
            <article
              key={r._id || r.id}
              className="rounded-xl border border-gray-200 p-4 bg-white"
            >
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: r.rating || 0 }).map((_, i) => (
                  <GiRoundStar key={i} />
                ))}
              </div>
              <p className="mt-2 text-gray-800">{r.review}</p>
              <div className="mt-2 text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
      {message}
    </div>
  );
}
