"use client";
import { useState } from "react";
import Link from "next/link";
import { Pagination } from "antd";
import { useGetOpenRequestsQuery } from "@/app/redux/features/requestsApi";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { RequestsNav, RequestMeta, StatusBadge, idOf } from "./shared";

export default function RequestsBoard() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: catData } = useGetAllCategoryQuery({});
  const { data, isFetching } = useGetOpenRequestsQuery({ category, search, page });
  const results = data?.results || [];

  return (
    <div className="container mx-auto px-4 py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Buyer requests</h1>
      <p className="text-gray-600 mb-5">Buyers describe what they need. Sellers send an offer; the buyer hires and pays into escrow.</p>
      <RequestsNav active="board" />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search requests"
          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white"
        >
          <option value="">All categories</option>
          {(catData?.results || []).map((c) => (
            <option key={idOf(c)} value={idOf(c)}>{c.name}</option>
          ))}
        </select>
      </div>
      {isFetching && !results.length ? (
        <div className="text-gray-500">Loading…</div>
      ) : !results.length ? (
        <div className="text-center py-16 text-gray-500">No open requests right now.</div>
      ) : (
        <div className="space-y-4">
          {results.map((r) => (
            <Link
              key={idOf(r)}
              href={`/requests/${idOf(r)}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-400 transition"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-lg font-semibold text-gray-900">{r.title}</h2>
                {r.myOfferStatus ? <StatusBadge status={r.myOfferStatus} /> : null}
              </div>
              <p className="text-gray-700 line-clamp-2 mb-3">{r.description}</p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <RequestMeta request={r} />
                <span className="text-xs text-gray-500">by {r.buyerId?.fullName || r.buyerId?.username || "buyer"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {(data?.totalResults || 0) > 20 && (
        <Pagination className="flex justify-center mt-8" current={page} pageSize={20} total={data.totalResults} onChange={setPage} showSizeChanger={false} />
      )}
    </div>
  );
}
