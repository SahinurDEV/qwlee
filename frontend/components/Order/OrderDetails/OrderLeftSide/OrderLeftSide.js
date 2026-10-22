"use client";
// Left column of the order detail page. Mirrors Fiverr's "Order page":
//   - Gig card (image + title + seller chip)
//   - Selected package summary (tier name, included features, delivery,
//     revisions)
//   - Requirements card (what the buyer submitted)
//   - Activity thread (messages + delivery notices)
//
// All data is read from the order object the parent already fetched, so
// no extra API calls here.

import Link from "next/link";
import moment from "moment";
import { IoCheckmarkCircle, IoTimeOutline } from "react-icons/io5";

import ImageWithFallback from "@/components/common/ImageWithFallback";
import Avatar from "@/components/common/Avatar";
import Activity from "./Activity";
import RequirementsCard from "./RequirementsCard";

export default function OrderSummary({ order, orderId, isSeller }) {
  const gig = order?.gigId || {};
  const seller = order?.freelancerId || {};
  const buyer = order?.clientId || {};
  const pkg = order?.data?.package || {};
  const requirements = order?.data?.requirements;
  const revisionsLeft = order?.data?.revisionsLeft;
  const packageName = order?.data?.packageName || pkg?.name || "Package";
  const deliveryDays = pkg?.deliveryDate || order?.data?.deliveryDays;
  const features = Array.isArray(pkg?.features) ? pkg.features : [];
  const counterparty = isSeller ? buyer : seller;
  const counterpartyRole = isSeller ? "Buyer" : "Seller";
  const slugOrId = gig?.slug || gig?._id || gig?.id;

  return (
    <>
      {/* Gig card */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="relative w-full sm:w-56 aspect-[16/10] sm:aspect-auto sm:h-auto bg-gray-100">
            <ImageWithFallback
              src={gig?.images?.[0]}
              name={gig?.title}
              fill
              sizes="(max-width: 640px) 100vw, 224px"
              className="object-cover"
              alt={gig?.title || "Gig"}
            />
          </div>
          <div className="p-4 sm:p-5 flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              {packageName} package
            </div>
            <h2 className="mt-1 text-base md:text-lg font-semibold text-gray-900 line-clamp-2">
              {slugOrId ? (
                <Link href={`/gig/${slugOrId}`} className="hover:text-emerald-700">
                  {gig?.title || order?.data?.title || "Gig"}
                </Link>
              ) : (
                gig?.title || order?.data?.title || "Gig"
              )}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar
                src={counterparty?.image}
                name={counterparty?.fullName}
                size={32}
                rounded
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {counterparty?.fullName || counterpartyRole}
                </div>
                <div className="text-xs text-gray-500">
                  {counterpartyRole}
                  {counterparty?.username ? ` · @${counterparty.username}` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Package details */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Package
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {packageName}
            </div>
          </div>
          {order?.price || pkg?.price ? (
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                Total
              </div>
              <div className="text-lg font-bold text-gray-900">
                ${Number(order?.price || pkg.price).toFixed(2)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5">
          <Stat label="Delivery" value={deliveryDays ? `${deliveryDays} days` : "—"} />
          <Stat
            label="Revisions left"
            value={Number.isFinite(revisionsLeft) ? String(revisionsLeft) : "—"}
          />
          <Stat
            label="Delivery date"
            value={
              order?.deliveryDate
                ? moment(order.deliveryDate).format("D MMM YYYY")
                : "—"
            }
          />
        </div>

        {features.length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
              What&rsquo;s included
            </div>
            <ul className="space-y-1.5">
              {features.map((f, i) => {
                const text = typeof f === "string" ? f : f?.feature || "";
                if (!text) return null;
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <IoCheckmarkCircle className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <RequirementsCard order={order} orderId={orderId} isSeller={isSeller} />

      {/* Requirements (legacy free-text) */}
      {requirements ? (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Requirements
            </h3>
            <span className="text-xs text-gray-500 inline-flex items-center gap-1">
              <IoTimeOutline />
              Submitted by buyer
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {requirements}
          </p>
        </section>
      ) : null}

      {/* Activity */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Activity
          </h3>
        </header>
        <Activity order={order} orderId={orderId} />
      </section>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
