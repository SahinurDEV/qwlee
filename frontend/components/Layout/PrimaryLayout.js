"use client";
// Top-level page chrome: sticky TopNav + sticky CategoryBar + page body
// + Footer. Replaces the old green-band Header. Existing pages still
// render unchanged below.
//
// Also mounts the activity tracker once, so every authed page-view
// gets reported to /v1/activity/track for the admin "monitor user"
// feature. Tracker is a no-op while signed out.

import TopNav from "./TopNav";
import CategoryBar from "./CategoryBar";
import Footer from "./Footer/Footer";
import useActivityTracker from "@/hooks/useActivityTracker";
import AnnouncementBar from "@/components/common/AnnouncementBar";

const PrimaryLayout = ({ children, isFooterAdd }) => {
  useActivityTracker();
  return (
    <>
      <AnnouncementBar />
      <TopNav />
      <CategoryBar />
      {children}
      {!isFooterAdd && <Footer />}
    </>
  );
};

export default PrimaryLayout;
