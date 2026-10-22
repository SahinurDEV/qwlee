"use client";
// Right-rail package selector — replaces the legacy ComparePackages radio
// list. Three tabs (typically Basic / Standard / Premium); each shows
// price, delivery, included features, and a Continue button that opens
// the existing checkout drawer via featureSlice — same redux contract
// AboutCard already listens to, so the drawer keeps working unchanged.
//
// Buyers see the live Continue button. Sellers (in selling mode or with
// role=freelancer) see a hint that ordering is buyer-only.

import Money from "@/components/common/Money";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import moment from "moment";
import { IoCheckmarkCircle, IoTimeOutline, IoRefreshOutline } from "react-icons/io5";

import useUser from "@/hooks/useUser";
import { setFeature } from "@/app/redux/slices/featureSlice";
import { useCreateBuyerOrderMutation, useGetOrderQuoteMutation } from "@/app/redux/features/order/buyerOrderApi";
import CheckoutReview from "./CheckoutReview";
import normaliseFeatures from "@/utils/normaliseFeatures";
import ContactSellerModal from "./ContactSellerModal";
import { isAway } from "@/components/common/AwayBanner";

export default function GigPackagePicker({ gig }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useUser();
  const [createOrder, { isLoading: ordering }] = useCreateBuyerOrderMutation();
  const [getQuote, { isLoading: quoting }] = useGetOrderQuoteMutation();
  const [review, setReview] = useState(null); // { quote, error } while the review is open
  const [coupon, setCoupon] = useState("");

  const packages = Array.isArray(gig?.package) ? gig.package : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const active = packages[activeIdx] || packages[0];
  const extras = Array.isArray(gig?.extras) ? gig.extras : [];
  const [extraIds, setExtraIds] = useState([]);
  const toggleExtra = (id) =>
    setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // Keep the redux "feature" in sync with the active tab so any other
  // component (existing AboutCard drawer, etc.) sees the latest pick.
  useEffect(() => {
    if (!active) return;
    dispatch(
      setFeature({
        ...active,
        gigTitle: gig?.title,
        image: gig?.images?.[0],
      })
    );
  }, [active, gig?.title, gig?.images, dispatch]);

  if (packages.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-sm text-gray-500">
        This gig has no packages yet.
      </div>
    );
  }

  const features = normaliseFeatures(active?.features);
  const basePrice = Number(active?.price || 0);
  const chosenExtras = extras.filter((e) => extraIds.includes(String(e._id || e.id)));
  // Display only; the server re-prices every order from the database.
  const price = basePrice + chosenExtras.reduce((n, e) => n + Number(e.price || 0), 0);
  const deliveryDays = Number(active?.deliveryDate || 0);
  const isFreelancer = user?.role === "freelancer";

  async function handleContinue() {
    if (!user) {
      toast.warning("Sign in to continue");
      router.push(`/sign-in?from=${encodeURIComponent(`/gig/${gig?.slug || gig?._id}`)}`);
      return;
    }
    if (isFreelancer) {
      toast.error("Only buyers can place orders. Switch to Buying to checkout.");
      return;
    }
    setReview({ quote: null, error: "" });
    setCoupon("");
    const q = await getQuote(orderData(""));
    if (q.error) setReview({ quote: null, error: q.error?.data?.message || "Could not price this order" });
    else setReview({ quote: q.data?.data?.attributes || q.data?.attributes || q.data, error: "" });
  }

  function orderData(code = coupon) {
    return { gigId: gig?._id || gig?.id, packageName: active?.name, extraIds, ...(code ? { couponCode: code } : {}) };
  }

  // Returns an error message, or "" when the coupon was applied/removed.
  async function applyCoupon(code) {
    const q = await getQuote(orderData(code));
    if (q.error) return q.error?.data?.message || "Coupon not valid";
    setCoupon(code);
    setReview({ quote: q.data?.data?.attributes || q.data?.attributes || q.data, error: "" });
    return "";
  }

  async function confirmOrder() {
    const res = await createOrder(orderData());
    if (res.error) {
      toast.error(res.error?.data?.message || "Could not start checkout");
      return;
    }
    if (res.data?.url) window.location.href = res.data.url;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-gray-100">
        {packages.map((p, i) => (
          <button
            key={p?.name || i}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-3 text-sm font-semibold transition border-b-2 ${
              i === activeIdx
                ? "text-emerald-700 border-emerald-600 bg-emerald-50/40"
                : "text-gray-500 border-transparent hover:text-gray-800"
            }`}
          >
            {p?.name || `Tier ${i + 1}`}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6">
        <div className="flex items-baseline justify-between">
          <div className="text-2xl md:text-3xl font-bold text-gray-900">
            <Money usd={price} />
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            {active?.name || ""}
          </div>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {active?.description || `Get a ${active?.name?.toLowerCase() || "service"} delivery from ${gig?.userId?.fullName || "this seller"}.`}
        </p>

        <div className="mt-4 flex items-center gap-5 text-sm text-gray-700">
          <span className="inline-flex items-center gap-1.5">
            <IoTimeOutline className="text-gray-400" />
            <span className="font-medium">{deliveryDays || "—"} day delivery</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IoRefreshOutline className="text-gray-400" />
            {Number.isFinite(Number(active?.revisions)) && active?.revisions !== "" && active?.revisions != null
              ? `${active.revisions} revision${Number(active.revisions) === 1 ? "" : "s"}`
              : "Revisions on request"}
          </span>
        </div>

        {features.length > 0 && (
          <ul className="mt-4 space-y-2">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <IoCheckmarkCircle className="mt-0.5 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        {extras.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">Gig extras</div>
            <ul className="space-y-2">
              {extras.map((e) => {
                const id = String(e._id || e.id);
                return (
                  <li key={id}>
                    <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extraIds.includes(id)}
                        onChange={() => toggleExtra(id)}
                        className="mt-1 accent-emerald-600"
                      />
                      <span className="flex-1">
                        {e.title}
                        {Number(e.deliveryDays) > 0 && (
                          <span className="text-xs text-gray-500"> (+{e.deliveryDays} day{Number(e.deliveryDays) > 1 ? "s" : ""})</span>
                        )}
                      </span>
                      <Money usd={e.price || 0} prefix="+" className="font-medium text-gray-900" />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={ordering || isFreelancer || isAway(gig?.userId)}
          className="mt-5 w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {ordering
            ? "Starting checkout…"
            : isAway(gig?.userId)
            ? "Seller is away"
            : isFreelancer
            ? "Buyers only"
            : `Continue ($${price.toLocaleString()})`}
        </button>

        {isFreelancer && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Switch to Buying in the top menu to place an order.
          </p>
        )}

        <CheckoutReview
          open={!!review}
          onClose={() => setReview(null)}
          onConfirm={confirmOrder}
          onApplyCoupon={applyCoupon}
          coupon={coupon}
          quote={review?.quote}
          error={review?.error}
          loading={quoting}
          confirming={ordering}
          gig={gig}
          packageName={active?.name}
        />

        <ContactSellerLink gig={gig} />
      </div>
    </div>
  );
}

function ContactSellerLink({ gig }) {
  const router = useRouter();
  const user = useUser();
  const seller = gig?.userId;
  const [open, setOpen] = useState(false);
  if (!seller) return null;
  function trigger() {
    if (!user) {
      router.push(
        `/sign-in?from=${encodeURIComponent(`/gig/${gig?.slug || gig?._id || ""}`)}`
      );
      return;
    }
    setOpen(true);
  }
  return (
    <>
      <button
        type="button"
        onClick={trigger}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-emerald-700 border border-gray-200 rounded-lg py-2 hover:border-emerald-200 transition"
      >
        Contact seller
      </button>
      <ContactSellerModal
        open={open}
        onClose={() => setOpen(false)}
        seller={seller}
        gig={gig}
      />
    </>
  );
}
