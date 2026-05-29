"use client";
// "Contact" — get-or-create a chat with the target user, then jump to
// /inbox/<chatId>. Used on the public profile and freelancer detail
// pages. If the viewer isn't signed in we bounce them through sign-in
// with a redirect-back so they land on the chat after auth.

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";

import useUser from "@/hooks/useUser";
import { useStartChatWithUserMutation } from "@/app/redux/features/inbox/inboxApi";

export default function ContactButton({
  receiverId,
  redirectBackTo,
  label = "Contact",
  className = "",
  iconLeft = true,
}) {
  const router = useRouter();
  const viewer = useUser();
  const [startChat, { isLoading }] = useStartChatWithUserMutation();

  async function handleClick() {
    if (!viewer) {
      // SignIn.js reads ?from=… set by the auth middleware; reusing the
      // same param means the post-login redirect Just Works.
      const back = redirectBackTo
        ? `?from=${encodeURIComponent(redirectBackTo)}`
        : "";
      router.push(`/sign-in${back}`);
      return;
    }
    if (
      String(viewer.id || viewer._id) === String(receiverId)
    ) {
      toast.info("You can't start a chat with yourself.");
      return;
    }
    const res = await startChat(receiverId);
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't open chat");
      return;
    }
    const chat = res?.data;
    const chatId = chat?.id || chat?._id || chat?.chat?.id || chat?.chat?._id;
    if (!chatId) {
      toast.error("Chat created but no id returned");
      return;
    }
    router.push(`/inbox/${chatId}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={
        className ||
        "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition"
      }
    >
      {iconLeft && <IoChatbubbleEllipsesOutline className="w-4 h-4" />}
      {isLoading ? "Opening…" : label}
    </button>
  );
}
