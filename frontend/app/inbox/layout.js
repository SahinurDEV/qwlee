'use client'
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Chat from "@/components/Inbox/Chat/Chat";
import { usePathname } from "next/navigation";

const InboxLayout = ({ children }) => {
  // On phones show either the list (/inbox) or the open thread (/inbox/:id),
  // driven by the URL so deep links and refreshes open the thread.
  const isOpen = /^\/inbox\/[^/]+/.test(usePathname() || "");
  return (
    <PrimaryLayout isFooterAdd={true}>
      <div className="w-full grid grid-cols-1 md:grid-cols-12 p-2 gap-4 md:container">
        {/* Mobile will show the chat below, while tablet/desktop has a two-column layout */}
        <div className={`w-full col-span-full md:col-span-4 ${isOpen ? "hidden" : "block"} md:block`}>
          <Chat />
        </div>
        <div className={`w-full col-span-full md:col-span-8 ${isOpen ? "block" : "hidden"} md:block`}>
          {children}
        </div>
      </div>
    </PrimaryLayout>
  );
};

export default InboxLayout;
