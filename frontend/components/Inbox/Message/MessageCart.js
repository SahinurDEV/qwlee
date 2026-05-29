"use client";
import {
  useCancelOrWithdrawOfferMutation,
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

const MessageCart = ({ message }) => {
  const user = useUser();
  const { id: messageId, content, chat, sender, createdAt } = message || {};
  const { data: receiver } = useGetChatQuery(chat);
  const me = user?.id === sender?.id;
  const [createOrder] = useCreateBuyerOrderMutation();
  const [cancelOfferMessage] = useCancelOrWithdrawOfferMutation();

  const handleOfferOrder = async () => {
    const { gigTitle, gigId, freelancerId, clientId, deliveryTime, price } =
      content?.offerDetails || {};
    const orderData = {
      items: [
        {
          name: gigTitle,
          price: price,
          quantity: 1,
        },
      ],
      messageId,
      gigId,
      freelancerId,
      clientId,
      deliveryDate: moment(new Date())
        .add(deliveryTime, "days")
        .format("YYYY-MM-DD"),
    };
    const res = await createOrder(orderData);
    if (res.error) {
      console.log(res.error);
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
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
            <div className="mt-2 text-[11px] text-gray-400 break-all">
              {url}
            </div>
          </div>
        );
      }
      return (
        <p
          className={`max-w-[500px] ${
            me ? "bg-primary text-white" : "bg-white"
          } border-[1px] border-secondary p-3 rounded-[18px] text-sm ${
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

  return (
    <>
      <div
        className={`flex items-end gap-3 my-5 ${
          me ? "flex-row-reverse mr-5" : "ml-5"
        }`}
      >
        <Image
          width={35}
          height={35}
          className="w-[35px] h-[35px] rounded-full"
          src={imgUrl(
            me ? user?.image : receiver?.participants[0]?.image
          )}
          alt=""
        />
        <div className={`flex flex-col gap-2 ${me ? "items-end" : "items-start"}`}>
          {gigRef && (gigRef.gigId || gigRef.title) && (
            <GigReferenceCard gigRef={gigRef} me={me} />
          )}
          {renderMessageContent()}
          <p
            className={`flex ${
              me ? "justify-end" : "justify-start"
            } pt-1 items-center text-xs gap-1 text-gray-500`}
          >
            <span>{formatTimestampMessage(createdAt)}</span>
          </p>
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
        <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold inline-flex items-center gap-1">
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
