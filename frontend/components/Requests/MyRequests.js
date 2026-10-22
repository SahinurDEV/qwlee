"use client";
import Link from "next/link";
import useUser from "@/hooks/useUser";
import { useGetMyRequestsQuery, useGetMyRequestOffersQuery } from "@/app/redux/features/requestsApi";
import { RequestsNav, RequestMeta, StatusBadge, idOf } from "./shared";

export default function MyRequests() {
  const user = useUser();
  const { data: reqs } = useGetMyRequestsQuery({});
  const { data: offers } = useGetMyRequestOffersQuery({}, { skip: user?.role !== "freelancer" });
  return (
    <div className="container mx-auto px-4 py-8 md:py-10 max-w-4xl">
      <RequestsNav active="mine" />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My requests</h1>
      {!(reqs?.results || []).length ? (
        <p className="text-gray-500 mb-8">You have not posted any requests. <Link className="text-emerald-700" href="/requests/new">Post one</Link>.</p>
      ) : (
        <div className="space-y-3 mb-10">
          {reqs.results.map((r) => (
            <Link key={idOf(r)} href={`/requests/${idOf(r)}`} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-400">
              <div className="flex justify-between gap-3 mb-1">
                <span className="font-semibold text-gray-900">{r.title}</span>
                <StatusBadge status={r.status} />
              </div>
              <RequestMeta request={r} />
            </Link>
          ))}
        </div>
      )}
      {user?.role === "freelancer" && (
        <>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Offers I sent</h2>
          {!(offers?.results || []).length ? (
            <p className="text-gray-500">No offers yet. <Link className="text-emerald-700" href="/requests">Browse requests</Link>.</p>
          ) : (
            <div className="space-y-3">
              {offers.results.map((o) => (
                <Link key={idOf(o)} href={`/requests/${idOf(o.requestId)}`} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-400">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-gray-900">{o.requestId?.title || "Request"}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">${o.price} · {o.deliveryDays} days</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
