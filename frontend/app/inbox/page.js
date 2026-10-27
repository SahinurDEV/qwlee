"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Blank from "@/components/Inbox/Message/Blank";
import { useGetChatsQuery } from "@/app/redux/features/inbox/inboxApi";

export default function InboxPage() {
  const router = useRouter();
  const { data, isFetching } = useGetChatsQuery(
    { archived: false },
    { refetchOnMountOrArgChange: true }
  );

  useEffect(() => {
    if (isFetching) return;
    const list = (data?.data || []).filter((c) => !!c?.lastMessage);
    if (!list.length) return;
    // Desktop: open the newest thread so the empty-state pane is not misleading.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      const id = list[0]?.chat?.id || list[0]?.chat?._id;
      if (id) router.replace(`/inbox/${id}`);
    }
  }, [data, isFetching, router]);

  return (
    <div className="bg-[#f5f5f5] w-full h-[calc(100vh-190px)] flex justify-center items-center rounded-xl">
      <Blank />
    </div>
  );
}
