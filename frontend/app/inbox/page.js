export const metadata = { title: "Inbox", robots: { index: false } };

import Blank from "@/components/Inbox/Message/Blank";
import React from "react";

const InboxPage = () => {
  return (
    <div className="bg-[#f5f5f5] w-full h-[calc(100vh-190px)] flex justify-center items-center rounded-xl">
      <Blank />
    </div>
  );
};

export default InboxPage;
