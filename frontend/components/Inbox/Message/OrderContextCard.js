"use client";
// Pinned under the chat header: the open order between the two members
// (or the most recent one), so both sides keep context while they talk.
import Link from "next/link";
import moment from "moment";
import { IoReceiptOutline } from "react-icons/io5";
import { useGetChatContextQuery } from "@/app/redux/features/inbox/inboxApi";

const OPEN = ["active", "late", "disputed"];
const TONE = {
  active: "bg-emerald-50 text-emerald-700",
  late: "bg-amber-50 text-amber-700",
  disputed: "bg-rose-50 text-rose-700",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function OrderContextCard({ chatId }) {
  const { data } = useGetChatContextQuery(chatId, { skip: !chatId });
  const orders = data?.orders || [];
  if (!orders.length) return null;
  const open = orders.filter((o) => OPEN.includes(o.status));
  const order = open[0] || orders[0];
  const more = open.length > 1 ? open.length - 1 : 0;
  return (
    <div className="px-3 md:px-4 py-2 border-b border-gray-100 bg-white flex items-center gap-3 text-sm">
      <IoReceiptOutline className="text-lg text-gray-500 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[11px] font-semibold uppercase rounded-full px-2 py-0.5 ${TONE[order.status] || TONE.delivered}`}>
            {order.status}
          </span>
          <span className="truncate text-gray-900 font-medium">{order.gig?.title || "Order"}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          ${Number(order.price || 0).toLocaleString()}
          {OPEN.includes(order.status) && order.deliveryDate ? ` · due ${moment(order.deliveryDate).format("MMM D")}` : ""}
          {more ? ` · ${more} more open` : ""}
        </div>
      </div>
      <Link
        href={`/order/${order.id}`}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50"
      >
        View order
      </Link>
    </div>
  );
}
