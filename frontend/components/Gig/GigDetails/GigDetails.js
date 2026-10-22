"use client";
// Gig detail page — Qwlee/Fiverr-style.
//
// 2-column layout:
//   - LEFT (8/12): breadcrumb · title · seller chip · image gallery ·
//     description · about-the-seller card · reviews
//   - RIGHT (4/12, sticky): package selector with Basic/Standard/Premium
//     tabs, feature list, delivery, Continue button.
//
// Loading + 404 states are handled here so the children can assume the
// gig exists. Everything below this component is purely presentational.

import Link from "next/link";
import { IoStar, IoChevronForward } from "react-icons/io5";

import { useGetGigDetailsQuery } from "@/app/redux/features/getGigDetailsApi";
import Avatar from "@/components/common/Avatar";

import GigGallery from "./GigGallery";
import GigPackagePicker from "./GigPackagePicker";
import { GigFaq, GigVideo } from "./GigFaqVideo";
import AboutCard from "./AboutCard";
import GigReviews from "./GigReviews";
import GigLoveReact from "./GigLoveReact";
import { useEffect } from "react";
import useRecentlyViewed from "@/hooks/useRecentlyViewed";

export default function GigDetails({ slug }) {
  const { data, isLoading, isError } = useGetGigDetailsQuery(slug);
  const result = data?.data?.attributes?.results?.[0];

  const { record } = useRecentlyViewed();
  useEffect(() => {
    if (result?._id || result?.id) record(result);
  }, [result?._id, result?.id, record]);

  if (isLoading) return <GigSkeleton />;

  if (isError || !result) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
          Gig not found
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          It may have been removed, or the link is incorrect.
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

  const seller = result.userId || {};
  const category = result.categoriesId || {};
  const reviewTotal = seller?.review?.total || 0;
  const reviewRating = Number(seller?.review?.rating || 0);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      {/* Breadcrumb */}
      <nav className="text-xs md:text-sm text-gray-500 flex items-center flex-wrap gap-1 mb-3">
        <Link href="/gig" className="hover:text-emerald-700">Marketplace</Link>
        {category?.name && (
          <>
            <IoChevronForward className="opacity-60" />
            <Link
              href={`/gig?categories=${encodeURIComponent(category.name)}`}
              className="hover:text-emerald-700"
            >
              {category.name}
            </Link>
          </>
        )}
        <IoChevronForward className="opacity-60" />
        <span className="text-gray-700 truncate max-w-[60%]">{result.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* Main column */}
        <div className="lg:col-span-8 min-w-0 space-y-6">
          <header>
            <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold text-gray-900 leading-tight">
              {result.title}
            </h1>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Avatar
                  src={seller.image}
                  name={seller.fullName}
                  size={40}
                  rounded
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                    {seller.fullName}
                    {seller.online && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" aria-label="Online" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {seller.username ? `@${seller.username}` : "Seller"}
                  </div>
                </div>
              </div>
              {reviewTotal > 0 && (
                <div className="inline-flex items-center gap-1 text-sm">
                  <IoStar className="text-amber-500" />
                  <span className="font-semibold text-gray-900">{reviewRating.toFixed(1)}</span>
                  <span className="text-gray-500">({reviewTotal})</span>
                </div>
              )}
              <div className="ml-auto">
                <GigLoveReact result={result} />
              </div>
            </div>
          </header>

          <GigVideo url={result.video} title={result.title} />
          <GigGallery images={result.images} title={result.title} />

          {/* About this gig */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              About this gig
            </h2>
            <div
              className="prose prose-sm md:prose-base max-w-none mt-3 text-gray-700"
              dangerouslySetInnerHTML={{ __html: result.description || "" }}
            />
          </section>

          <GigFaq faq={result.faq} />

          {/* About the seller — pulls the existing AboutCard but framed as a section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7">
            <AboutCard gig={result} user={seller} hideActions />
          </section>

          {/* Reviews */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7">
            <GigReviews id={result._id} sellerRating={reviewRating} sellerReviewTotal={reviewTotal} />
          </section>
        </div>

        {/* Right rail: package picker */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <GigPackagePicker gig={result} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function GigSkeleton() {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      <div className="h-3 w-48 bg-gray-100 rounded mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="h-8 w-3/4 bg-gray-100 rounded" />
          <div className="h-4 w-40 bg-gray-100 rounded" />
          <div className="aspect-[16/10] bg-gray-100 rounded-2xl" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-60 bg-gray-100 rounded-2xl" />
        </div>
        <div className="lg:col-span-4">
          <div className="h-96 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
