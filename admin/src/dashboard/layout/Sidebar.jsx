// Admin sidebar — collapsible on desktop, slide-over on mobile.
//
// Nav items are grouped with optional section labels so the sidebar stays
// readable even as we add more pages. Active-link styling comes from
// react-router's NavLink so it Just Works.

import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  BiSolidDashboard,
  BiSolidUserPlus,
} from "react-icons/bi";
import { FaUsersLine } from "react-icons/fa6";
import { MdCategory } from "react-icons/md";
import { HiLogout } from "react-icons/hi";
import { AiOutlineSafetyCertificate } from "react-icons/ai";
import { TbLogs, TbReportAnalytics, TbShoppingBag, TbSearch, TbFlag } from "react-icons/tb";
import { CiSettings } from "react-icons/ci";
import { PiHandWithdraw } from "react-icons/pi";
import { BsClipboardData } from "react-icons/bs";
import { LuLifeBuoy } from "react-icons/lu";
import {
  IoChevronBackOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";
import cls from "../../utils/cls";
import { confirmModal } from "../../common/confirm";

const NAV = [
  {
    section: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: BiSolidDashboard, end: true }],
  },
  {
    section: "Marketplace",
    items: [
      { to: "/dashboard/orders", label: "Orders", icon: TbShoppingBag },
      { to: "/dashboard/gigs", label: "Gigs", icon: BsClipboardData },
      { to: "/dashboard/disputes", label: "Disputes", icon: TbFlag },
      { to: "/dashboard/category", label: "Categories", icon: MdCategory },
      { to: "/dashboard/searches", label: "Search logs", icon: TbSearch },
    ],
  },
  {
    section: "People",
    items: [
      { to: "/dashboard/frelancer", label: "Freelancers", icon: FaUsersLine },
      { to: "/dashboard/buyerlist", label: "Buyers", icon: BiSolidUserPlus },
      { to: "/dashboard/seller-levels", label: "Seller levels", icon: AiOutlineSafetyCertificate },
    ],
  },
  {
    section: "Finance",
    items: [
      { to: "/dashboard/earnings", label: "Earnings", icon: AiOutlineSafetyCertificate },
      { to: "/dashboard/withdraw", label: "Withdrawals", icon: PiHandWithdraw },
    ],
  },
  {
    section: "Content",
    items: [
      { to: "/dashboard/blog", label: "Blog", icon: TbLogs },
      { to: "/dashboard/reports", label: "Reports", icon: TbReportAnalytics },
    ],
  },
  {
    section: "Support",
    items: [
      { to: "/dashboard/support", label: "Tickets", icon: LuLifeBuoy },
      {
        to: "/dashboard/verifications",
        label: "ID verifications",
        icon: AiOutlineSafetyCertificate,
      },
      {
        to: "/dashboard/conversations",
        label: "Conversations",
        icon: TbLogs,
      },
    ],
  },
  {
    section: "System",
    items: [{ to: "/dashboard/setting", label: "Settings", icon: CiSettings }],
  },
];

const COLLAPSED_KEY = "qwlee:admin:sidebarCollapsed";

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }

  useEffect(() => {
    if (onMobileClose) onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function handleLogout() {
    const ok = await confirmModal({
      title: "Sign out?",
      description: "You'll need to sign in again to access the admin dashboard.",
      confirmText: "Sign out",
      cancelText: "Stay signed in",
    });
    if (!ok) return;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  }

  const widthCls = collapsed ? "w-[72px]" : "w-[240px]";

  return (
    <>
      <div
        className={cls(
          "lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={cls(
          "fixed lg:sticky lg:top-0 left-0 top-0 h-screen z-50 bg-white border-r border-ink-200 transition-[width,transform] duration-200 flex flex-col",
          widthCls,
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cls(
            "h-16 flex items-center border-b border-ink-100",
            collapsed ? "justify-center px-2" : "px-5 justify-between"
          )}
        >
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-primary-700 font-bold"
          >
            <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">
              Q
            </span>
            {!collapsed && <span className="text-base">Qwlee Admin</span>}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex p-1.5 rounded-md text-ink-500 hover:bg-ink-100"
              aria-label="Collapse sidebar"
              title="Collapse"
            >
              <IoChevronBackOutline className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:inline-flex mx-auto mt-3 p-1.5 rounded-md text-ink-500 hover:bg-ink-100"
            aria-label="Expand sidebar"
            title="Expand"
          >
            <IoChevronForwardOutline className="w-4 h-4" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((group) => (
            <div key={group.section} className="mb-3">
              {!collapsed && (
                <div className="px-5 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {group.section}
                </div>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cls(
                          "mx-2 my-0.5 flex items-center gap-3 rounded-lg text-sm font-medium transition",
                          collapsed ? "justify-center h-10" : "px-3 py-2",
                          isActive
                            ? "bg-primary-50 text-primary-800"
                            : "text-ink-700 hover:bg-ink-100"
                        )
                      }
                    >
                      <item.icon style={{ width: 18, height: 18 }} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className={cls(
              "w-full flex items-center gap-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition",
              collapsed ? "justify-center h-10" : "px-3 py-2"
            )}
            title="Sign out"
          >
            <HiLogout className="w-4 h-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
