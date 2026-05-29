// React Router configuration for the admin app.
//
// `/dashboard` is the index route — it renders the dashboard home
// directly, no /dashboard/home segment. Old links pointing at
// /dashboard/home are kept as a redirect so they don't 404.

import { createBrowserRouter, Navigate } from "react-router-dom";

import baseUrl from "../baseUrl";

import BuyerList from "../dashboard/menu/BuyerList";
import DashboardHome from "../dashboardHome/DashboardHome";
import DashboardLayout from "../dashboard/layout/DashboardLayout";
import FrelancerList from "../dashboard/menu/FrelancerList";
import Earnings from "../dashboard/menu/Earnings";
import Category from "../dashboard/menu/Category";
import Blog from "../dashboard/menu/blogs/Blog";
import Settings from "../dashboard/menu/Settings";
import OtpVerify from "../dashboard/auth/OtpVerify";
import UpdatePassword from "../dashboard/auth/UpdatePassword";
import Forgotpassword from "../dashboard/auth/Forgotpassword";
import ErrorPage from "./ErrorPage";
import Notification from "../dashboard/menu/Notification";
import PersonalInfo from "../dashboard/menu/PersonalInfo";
import Privacy from "../dashboard/menu/privacyPolicy/Privacy";
import TermCondition from "../dashboard/menu/termcondition/TermCondition";
import Addblog from "../dashboard/menu/blogs/Addblog";
import EditBlog from "../dashboard/menu/blogs/EditBlog";
import EditPersonalInfo from "../dashboard/menu/EditPersonalInfo";
import EditPrivacyPolicy from "../dashboard/menu/privacyPolicy/EditPrivacyPolicy";
import EditTermCondition from "../dashboard/menu/termcondition/EditTermCondition";
import TrustSafety from "../dashboard/menu/trustsafety/TrustSafety";
import EditTrustSafety from "../dashboard/menu/trustsafety/EditTrustSafety";
import AdminRoute from "./AdminRoute";
import PublicRoute from "./PublicRoute";
import Withdraw from "../dashboard/menu/withdraw";
import DetailWithdraw from "../dashboard/menu/DetailWithdraw";
import Login from "../dashboard/auth/Login";
import Orders from "../dashboard/menu/Orders";
import Gigs from "../dashboard/menu/Gigs";
import Reports from "../dashboard/menu/Reports";
import UserDetail from "../dashboard/menu/UserDetail";
import Support from "../dashboard/menu/Support";
import Verifications from "../dashboard/menu/Verifications";
import Conversations from "../dashboard/menu/Conversations";
import SearchLogs from "../dashboard/menu/SearchLogs";
import SellerLevels from "../dashboard/menu/SellerLevels";
import Disputes from "../dashboard/menu/Disputes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "forgotpassword",
    element: (
      <PublicRoute>
        <Forgotpassword />
      </PublicRoute>
    ),
  },
  {
    path: "otp",
    element: (
      <PublicRoute>
        <OtpVerify />
      </PublicRoute>
    ),
  },
  {
    path: "updatepassword",
    element: (
      <PublicRoute>
        <UpdatePassword />
      </PublicRoute>
    ),
  },
  {
    path: "dashboard",
    element: (
      <AdminRoute>
        <DashboardLayout />
      </AdminRoute>
    ),
    children: [
      // Landing on /dashboard renders home directly.
      { index: true, element: <DashboardHome /> },
      // Back-compat: any stale /dashboard/home link redirects.
      { path: "home", element: <Navigate to="/dashboard" replace /> },
      { path: "frelancer", element: <FrelancerList /> },
      { path: "buyerlist", element: <BuyerList /> },
      { path: "earnings", element: <Earnings /> },
      { path: "withdraw", element: <Withdraw /> },
      { path: "category", element: <Category /> },
      { path: "withdrawDetails/:id", element: <DetailWithdraw /> },
      { path: "blog", element: <Blog /> },
      { path: "addblog", element: <Addblog /> },
      {
        path: "editblog/:id",
        element: <EditBlog />,
        loader: ({ params }) => fetch(`${baseUrl}/v1/blog/${params.id}`),
      },
      { path: "setting", element: <Settings /> },
      { path: "notification", element: <Notification /> },
      { path: "personalinfo", element: <PersonalInfo /> },
      { path: "editpersonalinfo", element: <EditPersonalInfo /> },
      { path: "privacy", element: <Privacy /> },
      { path: "editprivacypolicy", element: <EditPrivacyPolicy /> },
      { path: "terms", element: <TermCondition /> },
      { path: "editTermconditon", element: <EditTermCondition /> },
      { path: "trustsafety", element: <TrustSafety /> },
      { path: "editsafetytrust", element: <EditTrustSafety /> },
      { path: "orders", element: <Orders /> },
      { path: "gigs", element: <Gigs /> },
      { path: "reports", element: <Reports /> },
      { path: "users/:userId", element: <UserDetail /> },
      { path: "support", element: <Support /> },
      { path: "verifications", element: <Verifications /> },
      { path: "conversations", element: <Conversations /> },
      { path: "searches", element: <SearchLogs /> },
      { path: "seller-levels", element: <SellerLevels /> },
      { path: "disputes", element: <Disputes /> },
    ],
  },
]);
