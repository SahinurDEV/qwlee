"use client";
// Mobile slide-out menu. Mirrors the desktop TopNav structure including
// the Switch to Selling / Switch to Buying toggle, so mobile users get
// the same mode-driven navigation.

import { useI18n } from "@/components/Context/I18nProvider";
import { useState } from "react";
import { Drawer, Dropdown, Space } from "antd";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { IoIosArrowDown } from "react-icons/io";
import { MdArrowForwardIos } from "react-icons/md";

import { logout } from "@/actions/auth.services";
import { setUser } from "@/app/redux/slices/userSlice";
import useUser from "@/hooks/useUser";
import useViewMode, { SELLING, BUYING, clearViewMode } from "@/hooks/useViewMode";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import QwleeLogo from "@/components/common/QwleeLogo";
import Avatar from "@/components/common/Avatar";

export default function MobileDrawer({ open, onClose }) {
  const { t } = useI18n();
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { isSelling, toggleViewMode } = useViewMode(user);
  const SELLER_ONLY = ["/earnings", "/analytics", "/gig/add", "/gig/edit"];
  const BUYER_ONLY = ["/list"];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { data } = useGetAllCategoryQuery({});

  const Categories = data?.results?.map((item, index) => ({
    key: `${index + 1}`,
    label: (
      <div
        onClick={() => {
          router.push(`/gig?categories=${item?.name}`);
          onClose();
        }}
        className="hover:text-emerald-700"
      >
        {item?.name}
      </div>
    ),
  }));

  function go(path) {
    router.push(path);
    onClose();
  }

  function handleSwitchMode() {
    const next = isSelling ? BUYING : SELLING;
    toggleViewMode();
    toast.success(next === SELLING ? "Switched to Selling" : "Switched to Buying");
    const path = pathname || "/";
    const becomingBuyer = next === BUYING;
    const onSellerOnly = SELLER_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
    const onBuyerOnly = BUYER_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
    if ((becomingBuyer && onSellerOnly) || (!becomingBuyer && onBuyerOnly)) {
      go("/dashboard");
    } else {
      onClose();
    }
  }

  function handleLogout() {
    const refreshToken = Cookies.get("refreshToken");
    function finishLocally() {
      localStorage.removeItem("accessToken");
      Cookies.remove("user");
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");
      clearViewMode();
      dispatch(setUser(null));
      go("/sign-in");
      toast.success("Signed out");
    }
    Promise.resolve(refreshToken ? logout(refreshToken) : null)
      .catch(() => {
        /* Ignore — local cleanup still proceeds. */
      })
      .finally(finishLocally);
  }

  const sellingLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Earnings", path: "/earnings" },
    { label: "Analytics", path: "/analytics" },
    { label: "Manage orders", path: "/order" },
    { label: "Create a new gig", path: "/gig/add" },
    { label: "Wishlist", path: "/list" },
    user?.username && { label: "My public profile", path: `/${user.username}` },
  ].filter(Boolean);

  const buyingLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Orders", path: "/order" },
    { label: "Wishlist", path: "/list" },
    { label: "Browse services", path: "/gig" },
  ];

  const modeLinks = [...(isSelling ? sellingLinks : buyingLinks), { label: "Invite friends", path: "/referrals" }];

  return (
    <Drawer
      extra={
        <Link href="/" onClick={onClose} aria-label="Qwlee home">
          <QwleeLogo height={26} />
        </Link>
      }
      onClose={onClose}
      open={open}
      width={300}
    >
      {user ? (
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
            <Avatar src={user.image} name={user.fullName} size={44} rounded />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {user.fullName}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user.username ? `@${user.username}` : "Qwlee member"}
              </div>
            </div>
            <span
              className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isSelling
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-sky-50 text-sky-700 border border-sky-100"
              }`}
            >
              {isSelling ? "Selling" : "Buying"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSwitchMode}
            className="w-full text-left px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-50 mb-3"
          >
            {isSelling ? "Switch to Buying" : "Switch to Selling"}
          </button>

          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mt-2 mb-1">
            {isSelling ? "Selling" : "Buying"}
          </div>
          {modeLinks.map((l) => (
            <button
              key={l.path}
              type="button"
              onClick={() => go(l.path)}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
            >
              {l.label}
            </button>
          ))}

          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mt-4 mb-1">
            Account
          </div>
          <button
            type="button"
            onClick={() => go("/profile")}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
          >
            Profile settings
          </button>
          <button
            type="button"
            onClick={() => go("/inbox")}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => go("/support")}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
          >
            Help & support
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => go("/sign-in")}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
          >
            {t("signIn")}
          </button>
          <button
            type="button"
            onClick={() => go("/sign-up")}
            className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Join Qwlee
          </button>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-1">
          {t("explore")}
        </div>
        <button
          type="button"
          onClick={() => go("/")}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
        >
          Home
        </button>
        <button
          type="button"
          onClick={() => go("/gig")}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
        >
          Browse gigs
        </button>
        <div className="px-3 py-2">
          <Dropdown
            menu={{ items: Categories }}
            onOpenChange={(v) => setDropdownOpen(v)}
          >
            <div onClick={(e) => e.preventDefault()} className="cursor-pointer">
              <Space>
                <div className="flex justify-between items-center gap-4 w-full text-sm text-gray-800">
                  <span>{t("categories")}</span>
                  {dropdownOpen ? <IoIosArrowDown /> : <MdArrowForwardIos />}
                </div>
              </Space>
            </div>
          </Dropdown>
        </div>
      </div>

      {user && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Sign out
          </button>
        </div>
      )}
    </Drawer>
  );
}
