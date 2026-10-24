"use client";
// Homepage blog strip. Real data from /v1/blog, max 4 posts, consistent
// section header + "All articles" link. Sits on the global page surface
// so it harmonizes with the rest of the page (no section background of
// its own).

import { useI18n } from "@/components/Context/I18nProvider";
import Link from "next/link";
import Image from "next/image";
import { MdArrowForward } from "react-icons/md";
import BlogCard from "@/components/Blogs/BlogCard";
import BlogCardSkeleton from "@/components/Blogs/BlogCardSkeleton";
import { useGetAllBlogsQuery } from "@/app/redux/features/getAllBlogs";
import { RevealStagger, RevealItem } from "@/components/common/Reveal";

export default function TheLatestNewsAndBlog() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useGetAllBlogsQuery();
  const blogs = data?.data?.attributes?.results || [];

  let body = null;
  if (isLoading) {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <BlogCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (isError || blogs.length === 0) {
    body = (
      <div className="flex flex-col items-center text-center py-8">
        <Image width={200} height={200} src="/not-data.svg" alt="" />
        <p className="mt-2 text-gray-600">No posts yet</p>
      </div>
    );
  } else {
    body = (
      <RevealStagger
        gap={0.06}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {blogs.slice(0, 4).map((item) => (
          <RevealItem key={item._id || item.id}>
            <BlogCard item={item} />
          </RevealItem>
        ))}
      </RevealStagger>
    );
  }

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-6 md:mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              From the blog
            </span>
            <h2 className="mt-1 text-2xl md:text-3xl font-bold text-gray-900">
              {t("Insights for freelancers and buyers")}
            </h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">
              Tips on pricing, positioning, hiring, and shipping work that gets
              paid on time.
            </p>
          </div>
          <Link
            href="/blogs"
            className="hidden md:inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-sm shrink-0"
          >
            All articles <MdArrowForward />
          </Link>
        </div>

        {body}

        <div className="md:hidden mt-6 text-center">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 font-medium hover:bg-emerald-50 transition"
          >
            All articles <MdArrowForward />
          </Link>
        </div>
      </div>
    </section>
  );
}
