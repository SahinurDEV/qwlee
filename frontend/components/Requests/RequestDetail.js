"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useUser from "@/hooks/useUser";
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useSendRequestOfferMutation,
  useWithdrawRequestOfferMutation,
  useDeclineRequestOfferMutation,
  useGetMyCreditsQuery,
  useBuyCreditsMutation,
} from "@/app/redux/features/requestsApi";
import { useCreateBuyerOrderMutation } from "@/app/redux/features/order/buyerOrderApi";
import { RequestsNav, RequestMeta, StatusBadge, idOf, errMsg } from "./shared";

export default function RequestDetail({ id }) {
  const user = useUser();
  const { data, isLoading, isError } = useGetRequestQuery(id);
  const [updateRequest] = useUpdateRequestMutation();
  const [declineOffer] = useDeclineRequestOfferMutation();
  const [withdrawOffer] = useWithdrawRequestOfferMutation();
  const [createOrder, { isLoading: hiring }] = useCreateBuyerOrderMutation();

  if (isLoading) return <div className="container mx-auto px-4 py-10 text-gray-500">Loading…</div>;
  if (isError || !data?.request) return <div className="container mx-auto px-4 py-10 text-gray-500">Request not found.</div>;
  const { request, offers = [], isOwner } = data;
  const myOffer = !isOwner ? offers.find((o) => idOf(o.sellerId) === String(user?.id)) : null;
  const canOffer = user?.role === "freelancer" && !isOwner && request.status === "open" && (!myOffer || ["withdrawn", "declined"].includes(myOffer.status));

  async function hire(offer) {
    const res = await createOrder({ requestOfferId: idOf(offer) });
    if (res.error) return toast.error(errMsg(res, "Could not start checkout"));
    window.location = res.data.url;
  }
  async function act(fn, arg, ok) {
    const res = await fn(arg);
    if (res.error) return toast.error(errMsg(res, "Something went wrong"));
    toast.success(ok);
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-10 max-w-4xl">
      <RequestsNav active={isOwner ? "mine" : "board"} />
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-gray-700 whitespace-pre-line mb-4">{request.description}</p>
        <RequestMeta request={request} />
        {isOwner && request.status !== "hired" && (
          <button
            onClick={() => act(updateRequest, { id, status: request.status === "open" ? "closed" : "open" }, "Request updated")}
            className="mt-4 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:border-emerald-500"
          >
            {request.status === "open" ? "Close request" : "Reopen request"}
          </button>
        )}
        {request.orderId && isOwner && (
          <Link href={`/order/${idOf(request.orderId)}`} className="mt-4 inline-block text-emerald-700 font-medium">View order →</Link>
        )}
      </div>

      {canOffer && <OfferForm requestId={id} request={request} />}
      {!user && request.status === "open" && (
        <p className="text-gray-600 mb-6"><Link className="text-emerald-700 font-medium" href={`/sign-in?from=/requests/${id}`}>Sign in</Link> as a seller to send an offer.</p>
      )}

      {offers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{isOwner ? `Offers (${offers.length})` : "Your offer"}</h2>
          {offers.map((o) => (
            <div key={idOf(o)} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-medium text-gray-900">
                  {isOwner ? (
                    <Link href={`/${o.sellerId?.username || ""}`} className="hover:text-emerald-700">{o.sellerId?.fullName || o.sellerId?.username}</Link>
                  ) : "You"}
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-gray-700 whitespace-pre-line mb-3">{o.message}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  <b className="text-gray-900">${o.price}</b> · {o.deliveryDays} days · {o.revisions} revisions
                  {o.gigId?.title && <> · <Link className="text-emerald-700" href={`/gig/${o.gigId.slug}`}>{o.gigId.title}</Link></>}
                </div>
                <div className="flex gap-2">
                  {isOwner && o.status === "pending" && request.status === "open" && (
                    <>
                      <button disabled={hiring} onClick={() => hire(o)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                        Hire for ${o.price}
                      </button>
                      <button onClick={() => act(declineOffer, idOf(o), "Offer declined")} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Decline</button>
                    </>
                  )}
                  {!isOwner && o.status === "pending" && (
                    <button onClick={() => act(withdrawOffer, idOf(o), "Offer withdrawn")} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Withdraw</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OfferForm({ requestId, request }) {
  const [form, setForm] = useState({ price: String(request.budget), deliveryDays: String(request.deliveryDays), revisions: "1", message: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [send, { isLoading }] = useSendRequestOfferMutation();
  const { data: credits } = useGetMyCreditsQuery();
  const [buyCredits, { isLoading: buying }] = useBuyCreditsMutation();
  async function buy() {
    const res = await buyCredits(1);
    if (res.error) return toast.error(errMsg(res, "Could not buy credits"));
    toast.success(`${res.data.purchased} credits added`);
  }
  const short = credits?.enabled && credits.total < credits.costPerOffer;
  async function submit(e) {
    e.preventDefault();
    const res = await send({ requestId, price: Number(form.price), deliveryDays: Number(form.deliveryDays), revisions: Number(form.revisions), message: form.message });
    if (res.error) return toast.error(errMsg(res, "Could not send the offer"));
    toast.success("Offer sent");
  }
  const input = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none";
  return (
    <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-5 mb-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Send an offer</h2>
        {credits?.enabled ? (
          <div className="text-sm text-gray-600 flex items-center gap-2" data-testid="proposal-credits">
            <span>
              Costs <b>{credits.costPerOffer}</b> credit · you have <b>{credits.total}</b>
              {credits.nextRefillAt ? ` (free ${credits.monthlyAllowance} refill ${new Date(credits.nextRefillAt).toLocaleDateString()})` : ""}
            </span>
            <button type="button" onClick={buy} disabled={buying} className="px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-xs">
              Buy {credits.packSize} for ${Number(credits.packPrice).toFixed(2)}
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label><span className="text-sm">Price (USD)</span><input className={input} type="number" min={5} value={form.price} onChange={set("price")} required /></label>
        <label><span className="text-sm">Days</span><input className={input} type="number" min={1} max={90} value={form.deliveryDays} onChange={set("deliveryDays")} required /></label>
        <label><span className="text-sm">Revisions</span><input className={input} type="number" min={0} max={20} value={form.revisions} onChange={set("revisions")} /></label>
      </div>
      <label className="block"><span className="text-sm">Message to the buyer</span>
        <textarea className={input} rows={4} minLength={10} maxLength={2000} value={form.message} onChange={set("message")} required />
      </label>
      <button disabled={isLoading || short} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60">
        {isLoading ? "Sending…" : "Send offer"}
      </button>
    </form>
  );
}
