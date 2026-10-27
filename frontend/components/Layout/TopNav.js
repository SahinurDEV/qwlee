"use client";
// Qwlee top navigation v2.
//
// Sticky white bar above all pages. Real auth-state awareness (uses the
// shared useUser hook), real search (routes to /gig?title=), real
// notification badge (uses the existing getNotification API). No stubbed
// dropdowns — items here actually navigate somewhere real.
//
// Mobile: collapses to logo + menu button + search icon; the existing
// MobileDrawer handles the slide-out.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Dropdown } from "antd";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import {
  IoSearch,
  IoNotificationsOutline,
  IoStorefrontOutline,
  IoBagHandleOutline,
  IoChevronForward,
  IoHelpCircleOutline,
  IoSettingsOutline,
  IoStatsChartOutline,
  IoGiftOutline,
  IoLogOutOutline,
  IoSparklesOutline,
  IoCashOutline,
  IoListOutline,
  IoHeartOutline,
  IoTimeOutline,
  IoMailOutline,
  IoPersonCircleOutline,
} from "react-icons/io5";
import { HiOutlineMenu } from "react-icons/hi";
import { MdOutlineEmail } from "react-icons/md";
import { IoMdHeartEmpty } from "react-icons/io";

import useUser from "@/hooks/useUser";
import useViewMode, { SELLING, BUYING, clearViewMode } from "@/hooks/useViewMode";
import { logout } from "@/actions/auth.services";
import { setUser } from "@/app/redux/slices/userSlice";
import { useGetNotificationQuery } from "@/app/redux/features/getNotificationApi";
import { useGetUserQuery } from "@/app/redux/features/getSingleUserApi";
import QwleeLogo from "@/components/common/QwleeLogo";
import Avatar from "@/components/common/Avatar";
import SearchSuggestions from "@/components/Search/SearchSuggestions";
import CategoriesMenu from "./CategoriesMenu";
import { useI18n } from "@/components/Context/I18nProvider";
import NotificationsMenu from "./NotificationsMenu";
import MessagesMenu from "./MessagesMenu";
import MobileDrawer from "./Header/MobileDrawer";

export default function TopNav() {
  const { t } = useI18n();
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // useUser reads cookies, which are only present client-side. To avoid
  // SSR rendering "Sign in / Join" and the client immediately swapping
  // to the authed UI (hydration mismatch), gate every user-dependent
  // branch behind `mounted` — flips to true after first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const authedUser = mounted ? user : null;
  const { mode, isSelling, toggleViewMode } = useViewMode(authedUser);

  // Skip the notification query when unauth — keeps the API from 401-ing.
  const { data: notificationData } = useGetNotificationQuery(undefined, {
    skip: !authedUser,
  });
  const unread = notificationData?.unReadCount || 0;

  // Seller-mode balance pill — Fiverr-style. Reads the live balance off
  // the user record so it stays in sync after withdrawals / payouts.
  // Skipped when not logged in or not in selling mode to keep the API
  // quiet for buyers.
  const { data: userData } = useGetUserQuery(authedUser?.id, {
    skip: !authedUser?.id || !isSelling,
  });
  const balance = Number(userData?.data?.attributes?.user?.balance) || 0;
  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  // Drop a subtle shadow once the page scrolls a bit — tells the user the
  // bar is sticky without being heavy.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hide the inline search box on the homepage — the hero has its own
  // large search. Show it everywhere else.
  const showInlineSearch = pathname !== "/";

  function handleLogout() {
    const refreshToken = Cookies.get("refreshToken");
    // Local cleanup always runs — even if the backend call fails (network
    // down, stale token already removed server-side, etc.), the user
    // expects to be signed out on this device. We fire-and-forget the
    // server call and ignore non-success responses.
    function finishLocally() {
      localStorage.removeItem("accessToken");
      Cookies.remove("user");
      Cookies.remove("accessToken");
      fetch("/api/auth/clear-session", { method: "POST" }).catch(() => {});
      Cookies.remove("refreshToken");
      clearViewMode();
      dispatch(setUser(null));
      router.push("/sign-in");
      toast.success("Signed out");
    }
    Promise.resolve(refreshToken ? logout(refreshToken) : null)
      .catch(() => {
        // Ignore — local cleanup still proceeds.
      })
      .finally(finishLocally);
  }

  // Pages that only make sense in one mode — if the user switches modes
  // while standing on one of these, send them somewhere neutral.
  // Everywhere else (gig browse, gig detail, profile, inbox, …) stay put.
  const SELLER_ONLY = ["/earnings", "/analytics", "/gig/add", "/gig/edit"];
  const BUYER_ONLY = ["/list"];

  function handleSwitchMode() {
    const next = isSelling ? BUYING : SELLING;
    toggleViewMode();
    toast.success(next === SELLING ? "Switched to Selling" : "Switched to Buying");
    const path = pathname || "/";
    const becomingBuyer = next === BUYING;
    const onSellerOnly = SELLER_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
    const onBuyerOnly = BUYER_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
    if ((becomingBuyer && onSellerOnly) || (!becomingBuyer && onBuyerOnly)) {
      router.push("/dashboard");
    }
  }

  // Fiverr-style avatar popover. Single rich panel rendered via the
  // antd Dropdown's `dropdownRender` (we don't use the `menu` items
  // array because it can't host arbitrary JSX like the toggle row).
  const sellingLinks = [
    { icon: IoStorefrontOutline, label: "Dashboard", href: "/dashboard" },
    { icon: IoCashOutline, label: "Earnings", href: "/earnings" },
    { icon: IoStatsChartOutline, label: "Analytics", href: "/analytics" },
    { icon: IoSparklesOutline, label: "Seller Plus", href: "/seller-plan" },
    { icon: IoSparklesOutline, label: "Apply for Pro", href: "/pro" },
    { icon: IoListOutline, label: "Manage orders", href: "/order" },
    { icon: IoListOutline, label: "Hourly contracts", href: "/hourly" },
    { icon: IoSparklesOutline, label: "Contests", href: "/contests" },
    { icon: IoSparklesOutline, label: "Create a new gig", href: "/gig/add" },
    { icon: IoHeartOutline, label: "Wishlist", href: "/list" },
    { icon: IoTimeOutline, label: "Browsing history", href: "/history" },
    authedUser?.username && {
      icon: IoPersonCircleOutline,
      label: "My public profile",
      href: `/${authedUser.username}`,
    },
  ].filter(Boolean);

  const buyingLinks = [
    { icon: IoStorefrontOutline, label: "Dashboard", href: "/dashboard" },
    { icon: IoListOutline, label: "Orders", href: "/order" },
    { icon: IoListOutline, label: "Hourly contracts", href: "/hourly" },
    { icon: IoSparklesOutline, label: "Contests", href: "/contests" },
    { icon: IoHeartOutline, label: "Wishlist", href: "/list" },
    { icon: IoBagHandleOutline, label: "Browse services", href: "/gig" },
    { icon: IoSparklesOutline, label: "Qwlee Pro", href: "/pro" },
    { icon: IoSparklesOutline, label: "Teams", href: "/teams" },
    { icon: IoSparklesOutline, label: "Find talent", href: "/talent" },
    { icon: IoSparklesOutline, label: "AI workspace", href: "/ai-assistant" },
  ];

  const sharedLinks = [
    { icon: IoMailOutline, label: "Inbox", href: "/inbox" },
    { icon: IoGiftOutline, label: "Invite friends", href: "/referrals" },
    { icon: IoSettingsOutline, label: "Profile settings", href: "/profile" },
    { icon: IoHelpCircleOutline, label: "Help & support", href: "/support" },
  ];

  function UserPanel({ onClose }) {
    function go(href) {
      onClose?.();
      router.push(href);
    }
    return (
      <div
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden w-[300px]"
        style={{ boxShadow: "0 16px 40px rgba(15,23,42,0.12)" }}
      >
        {/* Identity card */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <Avatar
            src={authedUser?.image}
            name={authedUser?.fullName}
            size={44}
            rounded
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {authedUser?.fullName || "Member"}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {authedUser?.email ||
                (authedUser?.username ? `@${authedUser.username}` : "Qwlee member")}
            </div>
          </div>
        </div>

        {/* Mode switch row — Fiverr-style toggle pill */}
        <div className="px-3">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              handleSwitchMode();
            }}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition border border-gray-100"
          >
            <span className="flex items-center gap-2 text-sm text-gray-800">
              {isSelling ? (
                <IoBagHandleOutline className="w-4 h-4 text-sky-600" />
              ) : (
                <IoStorefrontOutline className="w-4 h-4 text-emerald-600" />
              )}
              <span className="font-medium">
                {isSelling ? "Switch to Buying" : "Switch to Selling"}
              </span>
            </span>
            <span
              className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isSelling
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-sky-50 text-sky-700 border border-sky-100"
              }`}
            >
              {isSelling ? "Selling" : "Buying"}
            </span>
          </button>
        </div>

        {/* Primary nav for the active mode */}
        <ul className="py-2 mt-2 border-t border-gray-100">
          {(isSelling ? sellingLinks : buyingLinks).map((l) => (
            <li key={l.label}>
              <button
                type="button"
                onClick={() => go(l.href)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 group"
              >
                <l.icon className="w-4 h-4 text-gray-500 group-hover:text-emerald-700" />
                <span className="flex-1 text-left">{l.label}</span>
                <IoChevronForward className="w-3.5 h-3.5 text-gray-300" />
              </button>
            </li>
          ))}
        </ul>

        {/* Shared links — inbox / settings / support */}
        <ul className="py-2 border-t border-gray-100">
          {sharedLinks.map((l) => (
            <li key={l.label}>
              <button
                type="button"
                onClick={() => go(l.href)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 group"
              >
                <l.icon className="w-4 h-4 text-gray-500 group-hover:text-emerald-700" />
                <span className="flex-1 text-left">{l.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Sign out */}
        <div className="border-t border-gray-100 p-2">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              handleLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
          >
            <IoLogOutOutline className="w-4 h-4" />
            {t("signOut")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-white border-b transition-shadow ${
          scrolled ? "shadow-sm border-gray-200" : "border-transparent"
        }`}
      >
        <div className="container mx-auto px-3 md:px-6 h-16 flex items-center gap-3 md:gap-6">
          {/* Logo */}
          <Link href="/" aria-label="Qwlee home" className="shrink-0">
            <QwleeLogo height={28} />
          </Link>

          {/* Desktop-only categories dropdown — sits next to the logo */}
          <div className="hidden md:block">
            <CategoriesMenu />
          </div>

          {/* Inline search (hidden on / — hero owns the homepage search).
              When hidden, the empty flex-1 spacer below still pushes the
              right nav to the right edge. */}
          {showInlineSearch && (
            <div className="hidden md:block flex-1 min-w-0 max-w-xl">
              <SearchSuggestions size="sm" placeholder={t("findService")} />
            </div>
          )}

          {/* Always flex-1 so the right-side nav anchors to the right
              regardless of whether the inline search is rendered. */}
          <div className="flex-1" />

          {/* Desktop right-side nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link
              href="/gig"
              className="px-3 py-2 rounded text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition"
            >
              {t("explore")}
            </Link>
            {/* "Switch to Buying / Switch to Selling" pill removed —
                the same toggle is still available inside the user
                avatar dropdown for users who need it. */}
            {!authedUser && (
              <Link
                href="/sign-in"
                className="ml-1 px-3 py-2 rounded text-gray-700 hover:text-emerald-700 transition"
              >
                {t("signIn")}
              </Link>
            )}
            {!authedUser && (
              <Link
                href="/sign-up"
                className="ml-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
              >
                {t("join")}
              </Link>
            )}

            {authedUser && (
              <>
                {isSelling && (
                  <Link
                    href="/earnings"
                    title="Available balance"
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 transition text-sm font-semibold"
                  >
                    <IoCashOutline className="w-4 h-4" />
                    <span className="tabular-nums">{formattedBalance}</span>
                  </Link>
                )}
                <Link
                  href="/list"
                  className="p-2 rounded-full text-gray-700 hover:bg-gray-100"
                  aria-label="Wishlist"
                  title="Wishlist"
                >
                  <IoMdHeartEmpty className="w-5 h-5" />
                </Link>
                {/* Inbox + notifications dropdowns — fetch only when
                    authed, click to mark read + navigate. */}
                <MessagesMenu active={!!authedUser} />
                <NotificationsMenu active={!!authedUser} />
                <UserAvatarDropdown user={authedUser} renderPanel={(close) => <UserPanel onClose={close} />} />
              </>
            )}
          </nav>

          {/* Mobile right-side */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => {
                const q = prompt("Find a service");
                if (q) router.push(`/gig?title=${encodeURIComponent(q.trim())}`);
              }}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100"
              aria-label="Search"
            >
              <IoSearch className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100"
              aria-label="Menu"
            >
              <HiOutlineMenu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        setOpen={setDrawerOpen}
        showDrawer={() => setDrawerOpen(true)}
        user={authedUser}
      />
    </>
  );
}

// Avatar + dropdown trigger. Owns the `open` state so the rich panel
// children can call `close()` after navigating (clicking a link in the
// panel should dismiss it).
function UserAvatarDropdown({ user, renderPanel }) {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      trigger={["click"]}
      dropdownRender={() => renderPanel(() => setOpen(false))}
    >
      <button
        type="button"
        className="ml-2 rounded-full ring-2 ring-transparent hover:ring-emerald-200 transition"
        aria-label="Open profile menu"
      >
        <Avatar src={user?.image} name={user?.fullName} size={36} rounded />
      </button>
    </Dropdown>
  );
}

function NavItem({ children, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-2 text-sm cursor-pointer ${
        danger ? "text-red-600" : "text-gray-800"
      } hover:bg-gray-50`}
    >
      {children}
    </div>
  );
}

