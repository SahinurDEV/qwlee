"use client";
// Order activity / chat thread. Renders messages in alternating bubbles
// like Fiverr's order chat — own messages right-aligned in emerald, the
// other party's left-aligned in white. Special-cases delivery messages
// (own bubble + "Accept delivery" CTA for the buyer).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import moment from "moment";
import { Image as AntdImage } from "antd";
import { toast } from "sonner";
import { FaXmark } from "react-icons/fa6";
import {
  IoSend,
  IoAttach,
  IoCheckmarkDone,
  IoCalendarOutline,
  IoLockClosedOutline,
  IoChatbubblesOutline,
  IoArrowForwardOutline,
} from "react-icons/io5";

import {
  useGetOrderMessageQuery,
  useSendOrderMessageMutation,
} from "@/app/redux/features/orderMessage/orderMessage.api";
import {
  useUpdateBuyerOrderStatusMutation,
  useRequestOrderRevisionMutation,
  useRespondOrderExtensionMutation,
} from "@/app/redux/features/order/buyerOrderApi";
import { useSocket } from "@/components/Context/SocketProvider";
import useUser from "@/hooks/useUser";
import formatTimestampMessage from "@/utils/formatTimestamp";
import { getImageUrl } from "@/utils/getImageUrl";
import Avatar from "@/components/common/Avatar";

export default function Activity({ order, orderId }) {
  const user = useUser();
  const { socket } = useSocket();
  const { data: messagesData } = useGetOrderMessageQuery(orderId, {
    skip: !orderId,
  });
  const [sendOrderMessage, { isLoading: sending }] = useSendOrderMessageMutation();
  const [updateOrder] = useUpdateBuyerOrderStatusMutation();
  const [requestRevision] = useRequestOrderRevisionMutation();
  const [respondExtension, { isLoading: extResponding }] =
    useRespondOrderExtensionMutation();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const bottomRef = useRef(null);

  const myId = String(user?.id || user?._id || "");
  const isSeller = !!user && String(order?.freelancerId?.id || order?.freelancerId?._id) === myId;
  const counterpartyId = isSeller
    ? order?.clientId?.id || order?.clientId?._id
    : order?.freelancerId?.id || order?.freelancerId?._id;

  useEffect(() => {
    if (messagesData?.attributes?.data) {
      setMessages(messagesData.attributes.data);
    }
  }, [messagesData]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg?.orderId === orderId) setMessages((prev) => [...prev, msg]);
    };
    socket.on("new-order-message", handler);
    return () => socket.off("new-order-message", handler);
  }, [socket, orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  const orderStarted = useMemo(() => {
    const buyerName = order?.clientId?.fullName || order?.clientId?.username || "The buyer";
    return `${buyerName} placed this order. Requirements have been shared — let’s get started.`;
  }, [order]);

  function handleFile(e) {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = ""; // allow re-selecting the same file
  }
  function removeAttachment(i) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSend() {
    if (!newMessage.trim() && attachments.length === 0) return;
    if (!counterpartyId) {
      toast.error("Missing recipient — refresh and try again.");
      return;
    }
    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("message", newMessage);
    formData.append("receiver", counterpartyId);
    attachments.forEach((f) => formData.append("files", f));
    const res = await sendOrderMessage(formData);
    if (res.error) {
      toast.error(res.error?.data?.message || "Could not send");
      return;
    }
    setNewMessage("");
    setAttachments([]);
  }

  async function handleRequestRevision() {
    const reason = window.prompt("What should the seller change?");
    if (reason === null) return;
    const res = await requestRevision({ orderId, reason });
    if (res.error) toast.error(res.error?.data?.message || "Could not request a revision");
    else toast.success("Revision requested");
  }

  async function handleAcceptDelivery() {
    const res = await updateOrder({ orderId, status: "delivered" });
    if (res.error) toast.error(res.error?.data?.message || "Could not accept");
    else toast.success("Delivery accepted");
  }

  async function handleExtensionResponse(action) {
    const res = await respondExtension({ orderId, action });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't respond");
      return;
    }
    toast.success(
      action === "accept" ? "Extension accepted" : "Extension declined"
    );
  }

  // After delivery accept or cancellation, the order chat is read-only.
  // Buyers/sellers continue the conversation in the main inbox so the
  // thread isn't fragmented across pages.
  const isClosed = order?.status === "delivered" || order?.status === "cancelled";
  const counterparty = isSeller ? order?.clientId : order?.freelancerId;
  const counterpartyName =
    counterparty?.fullName || counterparty?.username || "the other party";

  return (
    <div className="flex flex-col">
      <div className="px-5 py-3 bg-emerald-50/60 border-b border-emerald-100 text-sm text-emerald-800">
        <span className="font-semibold">Order started.</span> {orderStarted}
      </div>

      <div className="px-5 py-5 space-y-4 max-h-[520px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6">
            No activity yet — say hi to get started.
          </div>
        )}
        {messages.map((m) => {
          const mine = String(m?.sender?._id || m?.sender?.id) === myId;
          return (
            <MessageBubble
              key={m._id || m.id}
              message={m}
              mine={mine}
              isSeller={isSeller}
              orderStatus={order?.status}
              extensionStatus={order?.extensionRequest?.status}
              onAcceptDelivery={handleAcceptDelivery}
              onRequestRevision={handleRequestRevision}
              deliveryState={order?.delivery?.state}
              revisionsLeft={order?.data?.revisionsLeft}
              onRespondExtension={handleExtensionResponse}
              extResponding={extResponding}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer — locked once the order is delivered or cancelled.
          We surface a CTA into the main inbox so the conversation
          continues in one canonical place. */}
      {isClosed ? (
        <div className="border-t border-gray-100 px-5 py-5 bg-gray-50/40">
          <div className="flex items-start gap-3 rounded-xl bg-white border border-gray-200 p-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
              <IoLockClosedOutline className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                Order chat is closed
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {order?.status === "delivered"
                  ? "This delivery has been accepted. Continue the conversation with " +
                    counterpartyName +
                    " in your inbox."
                  : "This order was cancelled. You can still message " +
                    counterpartyName +
                    " in your inbox."}
              </p>
            </div>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
            >
              <IoChatbubblesOutline className="w-4 h-4" />
              Go to inbox
              <IoArrowForwardOutline className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/40">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message…"
            rows={3}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-emerald-500 text-sm resize-none"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((file, i) => (
                <AttachmentPreview key={i} file={file} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <label
              htmlFor="order-msg-attach"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg cursor-pointer hover:bg-white"
            >
              <IoAttach />
              Attach files
            </label>
            <input id="order-msg-attach" type="file" multiple className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!newMessage.trim() && attachments.length === 0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <IoSend />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  isSeller,
  orderStatus,
  extensionStatus,
  onAcceptDelivery,
  onRequestRevision,
  deliveryState,
  revisionsLeft,
  onRespondExtension,
  extResponding,
}) {
  const sender = message?.sender || {};
  const stamp = formatTimestampMessage(message?.createdAt);
  const content = message?.content || {};
  const messageType = content?.messageType;
  const text = content?.message;
  const files = Array.isArray(content?.files) ? content.files : [];
  const delivery = content?.deliveryDetails;
  const extension = content?.extensionDetails;
  const isDelivery = messageType === "deliveryMessage" || (delivery && delivery.message);
  const isExtensionRequest = messageType === "extensionRequest";
  const isExtensionResponse = messageType === "extensionResponse";

  return (
    <div className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar src={sender?.image} name={sender?.fullName} size={32} rounded />
      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-center gap-2 text-xs text-gray-500 mb-1 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="font-medium text-gray-800">
            {mine ? "You" : sender?.fullName || "Member"}
          </span>
          <span>·</span>
          <span>{stamp}</span>
        </div>
        {isDelivery ? (
          <DeliveryCard
            delivery={delivery}
            mine={mine}
            isSeller={isSeller}
            orderStatus={orderStatus}
            onAcceptDelivery={onAcceptDelivery}
            onRequestRevision={onRequestRevision}
            deliveryState={deliveryState}
            revisionsLeft={revisionsLeft}
          />
        ) : isExtensionRequest ? (
          <ExtensionRequestCard
            extension={extension}
            mine={mine}
            isSeller={isSeller}
            currentStatus={extensionStatus}
            onRespond={onRespondExtension}
            disabled={extResponding}
          />
        ) : isExtensionResponse ? (
          <ExtensionResponseCard extension={extension} />
        ) : (
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
              mine
                ? "bg-emerald-600 text-white rounded-tr-sm"
                : "bg-gray-100 text-gray-900 rounded-tl-sm"
            }`}
          >
            {text}
            {files.length > 0 && <FilesGrid files={files} mine={mine} />}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtensionRequestCard({ extension, mine, isSeller, currentStatus, onRespond, disabled }) {
  const newDate = extension?.newDeliveryDate
    ? moment(extension.newDeliveryDate).format("D MMM YYYY")
    : "—";
  // currentStatus reflects the live state on the order; older system
  // messages keep showing as resolved once the buyer responds.
  const resolved = currentStatus && currentStatus !== "pending";
  return (
    <div
      className={`rounded-2xl border p-4 max-w-md ${
        mine ? "bg-amber-50/60 border-amber-200" : "bg-white border-amber-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
          <IoCalendarOutline className="w-3 h-3" />
          Extension request
        </span>
        {resolved && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              currentStatus === "accepted"
                ? "text-emerald-700 bg-emerald-100"
                : "text-rose-700 bg-rose-100"
            }`}
          >
            {currentStatus === "accepted" ? "Accepted" : "Declined"}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800">
        New delivery date: <strong>{newDate}</strong>
      </p>
      {extension?.reason ? (
        <p className="mt-1.5 text-sm text-gray-700 italic line-clamp-5">
          “{extension.reason}”
        </p>
      ) : null}
      {!isSeller && !resolved && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRespond?.("accept")}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRespond?.("decline")}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ExtensionResponseCard({ extension }) {
  const accepted = extension?.status === "accepted";
  const newDate = extension?.newDeliveryDate
    ? moment(extension.newDeliveryDate).format("D MMM YYYY")
    : null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 max-w-md text-sm ${
        accepted
          ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
          : "bg-rose-50/60 border-rose-200 text-rose-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <IoCalendarOutline />
        <span className="font-semibold">
          {accepted ? "Extension accepted" : "Extension declined"}
        </span>
      </div>
      {accepted && newDate && (
        <p className="text-xs mt-1">New delivery date: {newDate}</p>
      )}
    </div>
  );
}

function DeliveryCard({ delivery, mine, isSeller, orderStatus, onAcceptDelivery, onRequestRevision, deliveryState, revisionsLeft }) {
  const accepted = orderStatus === "delivered";
  const closed = accepted || orderStatus === "cancelled";
  // Legacy orders have no delivery state; keep the old accept button.
  const awaitingBuyer = !closed && (deliveryState === "submitted" || !deliveryState || deliveryState === "none");
  const canRevise = !closed && deliveryState === "submitted" && Number(revisionsLeft) > 0;
  return (
    <div
      className={`rounded-2xl border p-4 max-w-md ${
        mine ? "bg-emerald-50/40 border-emerald-100" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
          Delivery
        </span>
        {accepted && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <IoCheckmarkDone /> Accepted
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-line">{delivery?.message}</p>
      {Array.isArray(delivery?.files) && delivery.files.length > 0 && (
        <FilesGrid files={delivery.files} />
      )}
      {!isSeller && (accepted || awaitingBuyer) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAcceptDelivery}
            disabled={accepted}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {accepted ? "Delivery accepted" : "Accept delivery"}
          </button>
          {canRevise && (
            <button
              type="button"
              onClick={onRequestRevision}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
            >
              Request revision ({revisionsLeft} left)
            </button>
          )}
        </div>
      )}
      {deliveryState === "revision" && !closed && (
        <p className="mt-2 text-xs text-amber-700">Revision requested. Waiting for the seller to redeliver.</p>
      )}
    </div>
  );
}

function FilesGrid({ files, mine }) {
  return (
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {files.map((file, i) => {
        const url = getImageUrl(file?.path) || file?.path;
        const isImage = file?.fileType === "image" || /\.(png|jpe?g|webp|gif|avif)$/i.test(file?.path || "");
        if (isImage && url) {
          return (
            <AntdImage
              key={i}
              src={url}
              alt={`Attachment ${i + 1}`}
              className="w-full h-24 object-cover rounded-md border"
            />
          );
        }
        return (
          <a
            key={i}
            href={url || "#"}
            target="_blank"
            rel="noreferrer"
            className={`block px-3 py-3 rounded-md text-xs font-medium border text-center ${
              mine ? "bg-white text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {file?.fileType?.toUpperCase() || "FILE"}
          </a>
        );
      })}
    </div>
  );
}

function AttachmentPreview({ file, onRemove }) {
  const isImage = file?.type?.startsWith("image/");
  return (
    <div className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-200 bg-white">
      {isImage ? (
        <AntdImage
          src={URL.createObjectURL(file)}
          alt={file?.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-600">
          <span className="font-semibold">FILE</span>
          <span className="truncate w-full text-center px-1">{file?.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 bg-white border border-gray-200 text-rose-600 rounded-full p-1 shadow"
        aria-label="Remove"
      >
        <FaXmark className="w-3 h-3" />
      </button>
    </div>
  );
}
