"use client";
import {
  useCancelOrWithdrawOfferMutation,
  useEditMessageMutation,
  useReactMessageMutation,
  useTranslateMessageMutation,
  useGetChatQuery,
} from "@/app/redux/features/inbox/inboxApi";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import formatTimestampMessage from "@/utils/formatTimestamp";
import { Image } from "antd";
import { BsArrowRepeat } from "react-icons/bs";
import { IoMdTime } from "react-icons/io";
import { IoStorefrontOutline, IoVideocamOutline } from "react-icons/io5";
import Link from "next/link";
import useUser from "@/hooks/useUser";
import moment from "moment";
import { useCreateBuyerOrderMutation } from "@/app/redux/features/order/buyerOrderApi";
import { toast } from "sonner";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import { confirmModal } from "@/components/common/confirm";
import { useState } from "react";

const fileLabel = (c) => {
  const t = c?.messageType;
  if (t === "image") return "Photo";
  if (t === "audio") return "Voice note";
  if (t === "offer") return "Custom offer";
  if (c?.files?.length) return "Attachment";
  return "";
};

// Short preview of the message being replied to.
export function replySnippet(m) {
  if (!m) return "";
  if (m.deletedForEveryone) return "Message deleted";
  return (m.content?.message || "").slice(0, 120) || fileLabel(m.content) || "Message";
}

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "✅", "🎉"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const browserLang = () => (typeof navigator !== "undefined" && (navigator.language || "en").slice(0, 2)) || "en";

const MessageCart = ({ message, onReply, onDelete, onUpdated, highlighted = false }) => {
  const user = useUser();
  const { id: messageId, content, chat, sender, createdAt, replyTo, deletedForEveryone, editedAt, reactions = [], autoReply } = message || {};
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [translation, setTranslation] = useState(null);
  const [editMessage, { isLoading: saving }] = useEditMessageMutation();
  const [reactMessage] = useReactMessageMutation();
  const [translateMessage, { isLoading: translating }] = useTranslateMessageMutation();
  const { data: receiver } = useGetChatQuery(chat);
  const me = user?.id === sender?.id;
  const [createOrder] = useCreateBuyerOrderMutation();
  const [cancelOfferMessage] = useCancelOrWithdrawOfferMutation();

  const handleOfferOrder = async () => {
    // Price, seller and delivery come from the offer on the server.
    const orderData = { messageId };
    const res = await createOrder(orderData);
    if (res.error) {
      toast.error(res.error?.data?.message || "Could not accept the offer");
      return;
    }
    if (res.data) {
      window.location = res?.data?.url;
    }
  };

  const handleWithdrawOffer = async (offerMessageId) => {
    try {
      const ok = await confirmModal({
        title: "Withdraw this offer?",
        description: "The buyer will no longer be able to accept it.",
        confirmText: "Withdraw offer",
        danger: true,
      });
      if (!ok) return;
      const res = await cancelOfferMessage(offerMessageId);
      if (res.error) {
        toast.error(res.error.data.message);
        return;
      }
      toast.success("Offer withdrawn");
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const handleCancelOfferOrder = async (offerMessageId) => {
    try {
      const ok = await confirmModal({
        title: "Cancel this offer?",
        description: "The seller will be notified the offer is no longer needed.",
        confirmText: "Cancel offer",
        danger: true,
      });
      if (!ok) return;
      const res = await cancelOfferMessage(offerMessageId);
      if (res.error) {
        toast.error(res.error.data.message);
        return;
      }
      toast.success("Offer cancelled");
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const renderMessageContent = () => {
    if (deletedForEveryone) {
      return (
        <p className="max-w-[500px] border border-dashed border-gray-300 text-gray-400 italic p-3 rounded-[18px] text-sm">
          {me ? "You deleted this message" : "This message was deleted"}
        </p>
      );
    }
    if (content.messageType === "audio" || content.messageType === "application" || content.messageType === "video") {
      return (
        <div className="space-y-2 max-w-[500px]">
          {content.message ? (
            <p className={`w-fit ${me ? "bg-primary text-white" : "bg-white"} border-[1px] border-secondary p-3 rounded-[18px] text-sm`}>
              {content.message}
            </p>
          ) : null}
          {(content.files || []).map((f, i) =>
            f.fileType === "audio" || content.messageType === "audio" ? (
              <audio key={i} controls preload="metadata" src={imgUrl(f.path)} className="w-[260px] max-w-full" aria-label="Voice note" />
            ) : (
              <a key={i} href={imgUrl(f.path)} target="_blank" rel="noreferrer" className="block underline text-sm text-emerald-700 break-all">
                Download attachment
              </a>
            )
          )}
        </div>
      );
    }
    if (content.messageType === "text") {
      // Video-call invite: bubble carries a magnifier-style card with a
      // Join button. We sniff the marker we wrote in Message.js
      // (📹 Started a video call. Tap to join: <jitsi-url>).
      const callMatch = (content?.message || "").match(
        /https?:\/\/meet\.jit\.si\/[^\s]+/
      );
      if (callMatch && /Started a video call/i.test(content.message)) {
        const url = callMatch[0];
        return (
          <div
            className={`max-w-[500px] rounded-2xl border p-4 ${
              me
                ? "bg-emerald-50/60 border-emerald-100"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <IoVideocamOutline /> Video call
              </span>
            </div>
            <p className="text-sm text-gray-800">
              {me ? "You" : sender?.fullName || "Someone"} started a video call.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              <IoVideocamOutline />
              Join call
            </a>
            <div className="mt-2 text-xs text-gray-400 break-all">
              {url}
            </div>
          </div>
        );
      }
      return (
        <p
          className={`max-w-[500px] ${
            me ? "bg-primary text-white" : "bg-white"
          } border-[1px] border-secondary p-3 rounded-[18px] text-sm break-words whitespace-pre-wrap ${
            me ? "rounded-br-none" : "rounded-bl-none"
          }`}
          style={{ minWidth: "50px" }}
        >
          {content?.message}
        </p>
      );
    } else if (content.messageType === "image") {
      const isSingleImage = content?.files.length === 1;
      const isDoubleImage = content?.files.length === 2;
      return (
        <div className="space-y-2">
          <div
            className={`max-w-[500px] flex ${
              me ? "justify-end" : "justify-start"
            }`}
          >
            {content.message && (
              <p
                className={`w-fit ${
                  me ? "bg-primary text-white" : "bg-white"
                } border-[1px] border-secondary p-3 rounded-[18px] text-sm ${
                  me ? "rounded-br-none" : "rounded-bl-none"
                }`}
              >
                {content?.message}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Image.PreviewGroup>
              <div
                className={`${
                  isSingleImage
                    ? "w-full"
                    : isDoubleImage
                    ? "grid grid-cols-2 gap-2"
                    : "grid grid-cols-2 sm:grid-cols-3 gap-2"
                }`}
              >
                {content?.files.map((file, index) => (
                  <Image
                    key={index}
                    width={isSingleImage ? 400 : isDoubleImage ? 200 : 120}
                    height={isSingleImage ? 250 : isDoubleImage ? 200 : 120}
                    className="rounded-lg"
                    src={imgUrl(file?.path)}
                    alt={`image-${index}`}
                  />
                ))}
              </div>
            </Image.PreviewGroup>
          </div>
        </div>
      );
    } else if (content.messageType === "offer") {
      const { offerDetails } = content;
      const isFreelancer = user?.role === "freelancer";
      const isAccepted = offerDetails?.status === "accepted";
      const isRejected = offerDetails?.status === "rejected";

      return (
        <div
          className={`max-w-[500px] ${
            me ? "bg-primary text-white" : "bg-white"
          } border-[1px] border-secondary py-2 rounded-[18px] text-sm ${
            me ? "rounded-br-none" : "rounded-bl-none"
          }`}
        >
          <h1 className="text-xl font-medium border-b px-4 py-3">
            <Link href={`/gig/${offerDetails?.slug}`}>
              {offerDetails?.gigTitle}
            </Link>
            <span className="font-bold ml-5">${offerDetails?.price}</span>
          </h1>
          <div className="p-4 border-b">
            <p className="text-[16px]">{offerDetails?.description}</p>
          </div>
          <div className="p-4 border-b">
            <h1 className="text-xl font-medium">Your Offer Includes</h1>
            <div className="flex gap-5 py-2">
              <h1 className="flex gap-2 items-center">
                <BsArrowRepeat className="size-5 font-semibold" />
                <span className="font-semibold">
                  {offerDetails?.revisionDays} Days Revisions
                </span>
              </h1>
              <h1 className="flex gap-2 items-center">
                <IoMdTime className="size-5 font-semibold" />
                <span className="font-semibold">
                  {offerDetails?.deliveryTime} Days Delivery
                </span>
              </h1>
            </div>
          </div>
          {offerDetails?.milestones?.length > 0 && (
            <div className="p-4 border-b">
              <h1 className="text-base font-medium">Paid in {offerDetails.milestones.length} milestones</h1>
              <ol className="mt-2 space-y-1 text-sm">
                {offerDetails.milestones.map((m, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{i + 1}. {m.title} <span className="text-gray-500">({m.days} days)</span></span>
                    <span className="font-semibold tabular-nums">${m.amount}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="flex justify-end p-4">
            {isFreelancer ? (
              isAccepted ? (
                <div className="flex gap-5">
                  <Link href={`/order/${offerDetails?.orderId}`}>
                    <button className="px-5 py-2 rounded bg-green-500 text-white">
                      View Order
                    </button>
                  </Link>
                  <button
                    disabled
                    className="px-5 py-2 rounded shadow bg-gray-100"
                  >
                    Offer Accepted
                  </button>
                </div>
              ) : isRejected ? (
                <button
                  disabled
                  className="px-5 py-2 rounded shadow bg-white text-green-500"
                >
                  Canceled Offer
                </button>
              ) : (
                <button
                  onClick={() => handleWithdrawOffer(messageId)}
                  className="px-5 py-2 rounded shadow bg-white text-green-500"
                >
                  Withdraw Offer
                </button>
              )
            ) : isAccepted ? (
              <div className="flex gap-5">
                <Link href={`/order/${offerDetails?.orderId}`}>
                  <button className="px-5 py-2 rounded bg-green-500 text-white">
                    View Order
                  </button>
                </Link>
                <button
                  disabled
                  className="px-5 py-2 rounded shadow bg-gray-100"
                >
                  Offer Accepted
                </button>
              </div>
            ) : isRejected ? (
              <button disabled className="px-5 py-2 rounded shadow bg-gray-100">
                Offer Canceled
              </button>
            ) : (
              <div className="flex gap-5">
                <button
                  onClick={() => handleCancelOfferOrder(messageId)}
                  className="px-5 py-2 rounded bg-green-500 text-white"
                >
                  Cancel Offer
                </button>
                <button
                  onClick={handleOfferOrder}
                  className="px-5 py-2 rounded shadow bg-gray-100"
                >
                  Accept Offer
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const gigRef = content?.gigReference;
  const msgId = messageId || message?._id;
  const canEdit =
    me && !deletedForEveryone && !autoReply && content?.messageType === "text" &&
    !/Started a video call/i.test(content?.message || "") &&
    Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
  const canTranslate = !me && !deletedForEveryone && !!(content?.message || "").trim();

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || text === content?.message) return setEditing(false);
    const res = await editMessage({ id: msgId, message: text });
    if (res.error) return toast.error(res.error?.data?.message || "Could not edit the message");
    onUpdated?.(res.data);
    setEditing(false);
  };
  const react = async (emoji) => {
    setReactOpen(false);
    const res = await reactMessage({ id: msgId, emoji });
    if (res.error) return toast.error(res.error?.data?.message || "Could not react");
    onUpdated?.(res.data);
  };
  const translate = async () => {
    if (translation) return setTranslation(null);
    const res = await translateMessage({ id: msgId, to: browserLang() });
    if (res.error) return toast.error(res.error?.data?.message || "Translation isn't available right now");
    setTranslation(res.data?.text || "");
  };
  const reactionGroups = Object.entries(
    (reactions || []).reduce((acc, r) => {
      acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false };
      acc[r.emoji].count += 1;
      if (String(r.user?._id || r.user?.id || r.user) === String(user?.id)) acc[r.emoji].mine = true;
      return acc;
    }, {})
  );

  const canDeleteForAll = me && !deletedForEveryone && content?.messageType !== "offer";
  const jumpTo = (id) => {
    const el = typeof document !== "undefined" && document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <div
        id={`msg-${messageId}`}
        className={`flex items-end gap-3 my-5 rounded-xl transition-colors ${
          me ? "flex-row-reverse mr-2 sm:mr-5" : "ml-2 sm:ml-5"
        } ${highlighted ? "bg-amber-50" : ""}`}
      >
        <Image
          width={35}
          height={35}
          className="w-[35px] h-[35px] rounded-full"
          src={imgUrl(
            me ? user?.image : receiver?.participants[0]?.image
          )}
          alt={(me ? user?.fullName : receiver?.participants?.[0]?.fullName) || "Profile photo"}
        />
        <div className={`flex flex-col gap-2 min-w-0 max-w-[80%] ${me ? "items-end" : "items-start"}`}>
          {replyTo && (replyTo.id || replyTo._id) && (
            <button
              type="button"
              onClick={() => jumpTo(replyTo.id || replyTo._id)}
              className="max-w-[500px] text-left text-xs border-l-4 border-emerald-400 bg-gray-100 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-200"
            >
              <span className="font-semibold text-gray-700">
                {String(replyTo.sender?.id || replyTo.sender?._id || replyTo.sender) === String(user?.id)
                  ? "You"
                  : replyTo.sender?.fullName || "Them"}
              </span>
              <span className="block truncate">{replySnippet(replyTo)}</span>
            </button>
          )}
          {gigRef && (gigRef.gigId || gigRef.title) && (
            <GigReferenceCard gigRef={gigRef} me={me} />
          )}
          {autoReply && !deletedForEveryone && (
            <span className="text-[11px] uppercase tracking-wide text-gray-400">Automatic reply</span>
          )}
          {editing ? (
            <div className="w-[280px] sm:w-[400px] max-w-full">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={5000}
                autoFocus
                aria-label="Edit message"
                className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                }}
              />
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1 text-xs rounded border border-gray-200">Cancel</button>
                <button type="button" onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">Save</button>
              </div>
            </div>
          ) : (
            renderMessageContent()
          )}
          {translation !== null && (
            <p className="max-w-[500px] text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2">
              <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Translated</span>
              {translation}
            </p>
          )}
          {reactionGroups.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reactionGroups.map(([emoji, g]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  className={`px-1.5 py-0.5 rounded-full border text-xs ${g.mine ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"}`}
                  aria-label={`${emoji} ${g.count}${g.mine ? ", including you" : ""}`}
                >
                  {emoji} {g.count > 1 ? g.count : ""}
                </button>
              ))}
            </div>
          )}
          <div
            className={`relative flex ${
              me ? "justify-end" : "justify-start"
            } pt-1 items-center text-xs gap-2 text-gray-500`}
          >
            <span>{formatTimestampMessage(createdAt)}{editedAt && !deletedForEveryone ? " · edited" : ""}</span>
            {!deletedForEveryone && onReply && (
              <button type="button" onClick={() => setReactOpen((v) => !v)} className="hover:text-emerald-700 underline-offset-2 hover:underline" aria-expanded={reactOpen}>
                React
              </button>
            )}
            {canEdit && !editing && (
              <button type="button" onClick={() => { setDraft(content?.message || ""); setEditing(true); }} className="hover:text-emerald-700 underline-offset-2 hover:underline">
                Edit
              </button>
            )}
            {canTranslate && (
              <button type="button" onClick={translate} disabled={translating} className="hover:text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50">
                {translation !== null ? "Original" : translating ? "Translating…" : "Translate"}
              </button>
            )}
            {reactOpen && (
              <div className={`absolute bottom-full mb-1 ${me ? "right-0" : "left-0"} z-20 flex gap-1 bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1`} role="menu" aria-label="Reactions">
                {REACTIONS.map((e) => (
                  <button key={e} type="button" role="menuitem" onClick={() => react(e)} className="text-lg leading-none p-1 hover:scale-125 transition-transform" aria-label={`React ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {!deletedForEveryone && onReply && (
              <button type="button" onClick={() => onReply(message)} className="hover:text-emerald-700 underline-offset-2 hover:underline">
                Reply
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className="hover:text-rose-600 underline-offset-2 hover:underline" aria-expanded={menuOpen}>
                Delete
              </button>
            )}
            {menuOpen && (
              <div className={`absolute top-full mt-1 ${me ? "right-0" : "left-0"} z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1`} role="menu">
                <button type="button" role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setMenuOpen(false); onDelete(message, "me"); }}>
                  Delete for me
                </button>
                {canDeleteForAll && (
                  <button type="button" role="menuitem" className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-gray-50" onClick={() => { setMenuOpen(false); onDelete(message, "everyone"); }}>
                    Delete for everyone
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Fiverr-style "you contacted X about this gig" card. Rendered above the
// associated text bubble whenever the message carries a gigReference
// snapshot. Self-contained so it tolerates the seller later editing or
// deleting the gig (the snapshot was frozen at send time).
function GigReferenceCard({ gigRef, me }) {
  const href = gigRef.slug
    ? `/gig/${gigRef.slug}`
    : gigRef.gigId
    ? `/gig/${gigRef.gigId}`
    : null;
  const card = (
    <div
      className={`w-[280px] sm:w-[320px] rounded-xl overflow-hidden border ${
        me
          ? "border-emerald-100 bg-emerald-50/60"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="relative w-full aspect-[16/10] bg-gray-100">
        <ImageWithFallback
          src={gigRef.image}
          name={gigRef.title}
          fill
          sizes="320px"
          className="object-cover"
          alt={gigRef.title || "Gig"}
        />
      </div>
      <div className="p-3">
        <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold inline-flex items-center gap-1">
          <IoStorefrontOutline />
          Gig reference
        </div>
        <div className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">
          {gigRef.title}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          {gigRef.deliveryDays ? (
            <span className="inline-flex items-center gap-1">
              <IoMdTime />
              {gigRef.deliveryDays} day delivery
            </span>
          ) : (
            <span />
          )}
          {gigRef.price ? (
            <span className="text-sm font-semibold text-gray-900">
              ${Number(gigRef.price).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-95 transition">
      {card}
    </Link>
  ) : (
    card
  );
}

export default MessageCart;
