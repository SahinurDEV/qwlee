"use client";
// Qwlee wishlist page. Reuses the marketplace GigCard so the heart and
// hover behaviours stay consistent — clicking the heart removes the
// item without leaving the page (optimistic update via useWishlist).

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useGetCollectionsQuery,
  useMoveToCollectionMutation,
  useRenameCollectionMutation,
  useDeleteCollectionMutation,
} from "@/app/redux/features/collectionsApi";
import Image from "next/image";
import { IoHeartCircleOutline } from "react-icons/io5";

import { useGetMyListQuery } from "@/app/redux/features/getMyListApi";
import useUser from "@/hooks/useUser";
import GigCard from "@/components/common/GigCard";
import GigCardSkeleton from "@/components/Gig/GigCardSkeleton";

export default function MyList() {
  const user = useUser();
  const { data, isLoading, isError } = useGetMyListQuery(undefined, {
    skip: !user,
  });
  const items = (data?.data?.attributes?.results || []).filter((e) => e?.gigId && (e.gigId._id || e.gigId.id));
  const { data: collections = [] } = useGetCollectionsQuery(undefined, { skip: !user });
  const [move] = useMoveToCollectionMutation();
  const [renameC] = useRenameCollectionMutation();
  const [deleteC] = useDeleteCollectionMutation();
  // ?collection=<name> opens that collection (links from the dashboard).
  const initialTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("collection") : null;
  const [tab, setTab] = useState(initialTab); // null = all, "" = Saved, else a name
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState([]); // created here, still empty
  const named = [...new Set([...collections.filter((c) => c.name).map((c) => c.name), ...drafts])];
  const visible = tab === null ? items : items.filter((e) => (e.collectionName || "") === tab);
  const gigs = visible.map((e) => e.gigId);

  const moveTo = async (gigId, collection) => {
    const r = await move({ gigId, collection });
    if (r.error) return toast.error(r.error?.data?.message || "Could not move");
    toast.success(collection ? `Moved to "${collection}"` : "Moved to Saved");
  };
  const create = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setDrafts((d) => (d.includes(name) ? d : [...d, name]));
    setTab(name);
    toast.success(`Collection "${name}" ready. Use "Move to" on a gig to add it.`);
  };
  const rename = async () => {
    const to = window.prompt("Rename collection", tab);
    if (!to || to.trim() === tab) return;
    if (!items.some((e) => e.collectionName === tab)) {
      setDrafts((d) => [...d.filter((x) => x !== tab), to.trim().slice(0, 40)]);
      return setTab(to.trim().slice(0, 40));
    }
    const r = await renameC({ from: tab, to });
    if (r.error) return toast.error(r.error?.data?.message || "Could not rename");
    setDrafts((d) => d.filter((x) => x !== tab));
    setTab(to.trim());
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${tab}"? Its gigs stay in Saved.`)) return;
    setDrafts((d) => d.filter((x) => x !== tab));
    const r = await deleteC(tab);
    if (r.error) return toast.error(r.error?.data?.message || "Could not delete");
    setTab(null);
    toast.success("Collection deleted");
  };
  const tabs = [
    { key: null, label: "All", count: items.length },
    { key: "", label: "Saved", count: items.filter((e) => !e.collectionName).length },
    ...named.map((n) => ({ key: n, label: n, count: items.filter((e) => e.collectionName === n).length })),
  ];
  const options = named;

  return (
    <main className="container mx-auto px-4 py-8 md:py-10">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 inline-flex items-center gap-2">
            <IoHeartCircleOutline className="text-rose-500 w-7 h-7" />
            My Wishlist
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gigs you&rsquo;ve saved across the Qwlee marketplace.
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </header>

      {user && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5" role="tablist" aria-label="Collections">
          {tabs.map((t) => (
            <button
              key={t.key ?? "__all"}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm px-3 py-1.5 rounded-full border ${tab === t.key ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
            >
              {t.label} <span className="opacity-70">{t.count}</span>
            </button>
          ))}
          <form onSubmit={create} className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder="New collection"
              aria-label="New collection name"
              className="text-sm border border-gray-200 rounded-full px-3 py-1.5 w-40"
            />
            <button disabled={!newName.trim()} className="text-sm px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 disabled:opacity-50">Add</button>
          </form>
          {tab ? (
            <span className="flex gap-2 ml-auto">
              <button type="button" onClick={rename} className="text-sm text-gray-600 hover:underline">Rename</button>
              <button type="button" onClick={remove} className="text-sm text-rose-600 hover:underline">Delete collection</button>
            </span>
          ) : null}
        </div>
      )}

      {!user ? (
        <SignInPrompt />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <GigCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : gigs.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl p-8 text-center">Nothing here yet. Use &ldquo;Move to&rdquo; under a saved gig to add it.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
          {visible.map((e) => {
            const gig = e.gigId;
            const id = gig._id || gig.id;
            return (
              <div key={id} className="flex flex-col gap-2">
                <GigCard item={gig} />
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  Move to
                  <select
                    value={e.collectionName || ""}
                    onChange={(ev) => moveTo(id, ev.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                  >
                    <option value="">Saved</option>
                    {options.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
      <Image src="/not-data.svg" width={180} height={180} alt="" className="mx-auto opacity-80" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Your wishlist is empty
      </h2>
      <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
        Tap the heart on any gig to save it here for later.
      </p>
      <Link
        href="/gig"
        className="inline-block mt-5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
      >
        Browse gigs
      </Link>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-8 text-center">
      <h3 className="text-base font-semibold text-rose-700">
        We couldn&rsquo;t load your wishlist
      </h3>
      <p className="text-sm text-rose-600 mt-1">
        Please refresh and try again.
      </p>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
      <h2 className="text-lg font-semibold text-gray-900">Sign in to see your wishlist</h2>
      <p className="mt-1 text-sm text-gray-500">
        Save gigs to come back to them anytime.
      </p>
      <Link
        href="/sign-in?from=/list"
        className="inline-block mt-5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
      >
        Sign in
      </Link>
    </div>
  );
}
