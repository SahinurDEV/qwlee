// Sticky topbar.
//
// Renders the page title from a small route → title map (so the bar
// always reflects what the user is looking at), a search input that
// jumps to a route by keyword, a notifications dropdown that pulls from
// the backend, and a profile chip.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { IoIosNotificationsOutline } from "react-icons/io";
import { FaRegUser } from "react-icons/fa6";
import { MdMenu } from "react-icons/md";
import { IoSearch } from "react-icons/io5";

import { useGetNotificationQuery } from "../../redux/api/apiSlice";
import useAdminSocket from "../../hooks/useAdminSocket";
import toast from "react-hot-toast";
import cls from "../../utils/cls";
import { timeAgo } from "../../utils/format";

const ROUTE_TITLES = [
  { match: /^\/dashboard\/orders/, title: "Orders" },
  { match: /^\/dashboard\/gigs/, title: "Gigs" },
  { match: /^\/dashboard\/category/, title: "Categories" },
  { match: /^\/dashboard\/frelancer/, title: "Freelancers" },
  { match: /^\/dashboard\/buyerlist/, title: "Buyers" },
  { match: /^\/dashboard\/earnings/, title: "Earnings" },
  { match: /^\/dashboard\/withdraw/, title: "Withdrawals" },
  { match: /^\/dashboard\/blog/, title: "Blog" },
  { match: /^\/dashboard\/reports/, title: "Reports" },
  { match: /^\/dashboard\/setting/, title: "Settings" },
  { match: /^\/dashboard\/notification/, title: "Notifications" },
  { match: /^\/dashboard\/personalinfo/, title: "My profile" },
  { match: /^\/dashboard\/privacy/, title: "Privacy policy" },
  { match: /^\/dashboard\/terms/, title: "Terms & conditions" },
  { match: /^\/dashboard\/trustsafety/, title: "Trust & safety" },
  // Index match goes last so more-specific routes above win first.
  { match: /^\/dashboard\/?$/, title: "Dashboard" },
];

const QUICK_LINKS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Orders", path: "/dashboard/orders" },
  { label: "Gigs", path: "/dashboard/gigs" },
  { label: "Categories", path: "/dashboard/category" },
  { label: "Freelancers", path: "/dashboard/frelancer" },
  { label: "Buyers", path: "/dashboard/buyerlist" },
  { label: "Earnings", path: "/dashboard/earnings" },
  { label: "Withdrawals", path: "/dashboard/withdraw" },
  { label: "Blog", path: "/dashboard/blog" },
  { label: "Settings", path: "/dashboard/setting" },
  { label: "My profile", path: "/dashboard/personalinfo" },
];

export default function Header({ onOpenMobileSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications, refetch: refetchNotifs } = useGetNotificationQuery(undefined, { pollingInterval: 30000 });
  const [liveNotifs, setLiveNotifs] = useState([]);
  const items = [...liveNotifs, ...(notifications?.data?.attributes?.results || [])]
    .filter((n, i, arr) => arr.findIndex((x) => String(x.id || x._id) === String(n.id || n._id)) === i);
  const unread = items.filter((n) => !n.viewStatus).length;

  useAdminSocket({
    onRiskFlag: (payload) => {
      const flag = payload?.data?.flag;
      const n = payload?.data?.notification;
      if (n) setLiveNotifs((prev) => [{ ...n, id: n.id || `live-${Date.now()}`, viewStatus: false }, ...prev].slice(0, 30));
      toast((tt) => (
        <div className="text-sm">
          <div className="font-semibold text-ink-900">Message flagged</div>
          <div className="text-ink-600">{n?.message || flag?.excerpt || "Contact sharing detected"}</div>
          <button type="button" className="mt-1 text-primary-700 underline" onClick={() => { toast.dismiss(tt.id); navigate(`/dashboard/conversations?tab=flagged${flag?.chatId ? `&chat=${flag.chatId}` : ""}`); }}>
            Open Flagged queue
          </button>
        </div>
      ), { duration: 8000 });
      refetchNotifs?.();
    },
    onNotification: (payload) => {
      const n = payload?.data?.notification || payload?.data;
      if (n?.message) setLiveNotifs((prev) => [{ ...n, id: n.id || `live-${Date.now()}`, viewStatus: false }, ...prev].slice(0, 30));
      refetchNotifs?.();
    },
  });

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const title = useMemo(() => {
    const hit = ROUTE_TITLES.find((r) => r.match.test(location.pathname));
    return hit?.title || "Admin";
  }, [location.pathname]);

  useEffect(() => {
    function close(e) {
      if (notifOpen && !notifRef.current?.contains(e.target)) setNotifOpen(false);
      if (profileOpen && !profileRef.current?.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notifOpen, profileOpen]);

  const [search, setSearch] = useState("");
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return QUICK_LINKS.filter((l) => l.label.toLowerCase().includes(q)).slice(0, 6);
  }, [search]);

  function handleSubmit(e) {
    e.preventDefault();
    if (suggestions[0]) {
      navigate(suggestions[0].path);
      setSearch("");
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ink-200">
      <div className="h-16 px-4 md:px-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 -ml-2 rounded-md text-ink-700 hover:bg-ink-100"
          aria-label="Open sidebar"
        >
          <MdMenu className="w-5 h-5" />
        </button>
        <h1 className="text-base md:text-lg font-semibold text-ink-900 truncate">
          {title}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="relative ml-auto hidden md:flex items-center bg-ink-50 rounded-lg px-3 py-1.5 w-72 focus-within:ring-2 focus-within:ring-primary-200"
        >
          <IoSearch className="text-ink-400 mr-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Jump to…"
            className="bg-transparent outline-none text-sm w-full"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-ink-200 rounded-xl shadow-pop overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.path}
                  type="button"
                  onClick={() => {
                    navigate(s.path);
                    setSearch("");
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 flex items-center justify-between"
                >
                  <span>{s.label}</span>
                  <span className="text-xs text-ink-400">{s.path}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div ref={notifRef} className="relative ml-auto md:ml-0">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-full text-ink-700 hover:bg-ink-100"
            aria-label="Notifications"
          >
            <IoIosNotificationsOutline className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-xs min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] bg-white border border-ink-200 rounded-2xl shadow-pop overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                <div className="font-semibold text-ink-900">Notifications</div>
                {unread > 0 && (
                  <span className="text-xs text-primary-700 font-medium">
                    {unread} unread
                  </span>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-ink-500">
                    No notifications yet.
                  </div>
                ) : (
                  items.slice(0, 8).map((n) => (
                    <div
                      key={n._id || n.id}
                      className="px-4 py-3 border-b border-ink-100 last:border-b-0 flex items-start gap-2"
                    >
                      <span
                        className={cls(
                          "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                          n.viewStatus ? "bg-ink-200" : "bg-primary-500"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink-800">{n.message}</div>
                        <div className="text-xs text-ink-400 mt-0.5">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-3 border-t border-ink-100 text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                  onClick={() => {
                    setNotifOpen(false);
                    navigate("/dashboard/notification");
                  }}
                >
                  See all →
                </button>
              </div>
            </div>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="p-1.5 pr-3 flex items-center gap-2 rounded-full text-ink-700 hover:bg-ink-100"
            aria-label="Profile menu"
          >
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
              <FaRegUser className="w-3.5 h-3.5" />
            </span>
            <span className="hidden md:inline text-sm font-medium">Admin</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-ink-200 rounded-xl shadow-pop overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/dashboard/personalinfo");
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-ink-50"
              >
                My profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/dashboard/setting");
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-ink-50"
              >
                Settings
              </button>
              <div className="border-t border-ink-100" />
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  navigate("/");
                }}
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
