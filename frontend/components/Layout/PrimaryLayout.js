"use client";
// Top-level page chrome: sticky TopNav + sticky CategoryBar + page body
// + Footer. Replaces the old green-band Header. Existing pages still
// render unchanged below.
//
// Also mounts the activity tracker once, so every authed page-view
// gets reported to /v1/activity/track for the admin "monitor user"
// feature. Tracker is a no-op while signed out.

import { Suspense } from "react";
import TopNav from "./TopNav";
import CategoryBar from "./CategoryBar";
import Footer from "./Footer/Footer";
import useActivityTracker from "@/hooks/useActivityTracker";
import AnnouncementBar from "@/components/common/AnnouncementBar";
import CookieBanner from "@/components/common/CookieBanner";

function Chrome({ children, isFooterAdd }) {
  useActivityTracker();
  return (
    <>
      <AnnouncementBar />
      <TopNav />
      <CategoryBar />
      {children}
      {!isFooterAdd && <Footer />}
      <CookieBanner />
    </>
  );
}

// The Suspense boundary lives here (not in the root layout) so a server
// page can still call notFound() before streaming starts and the
// response carries a real 404 status.
const PrimaryLayout = (props) => (
  <Suspense fallback={null}>
    <Chrome {...props} />
  </Suspense>
);

export default PrimaryLayout;
