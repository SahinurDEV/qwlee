"use client";
import BlogCard from "@/components/Blogs/BlogCard";
import Loading from "@/components/CustomCreate/Loading";
import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useGetAllBlogsQuery } from "../redux/features/getAllBlogs";

const TABS = [["", "All"], ["article", "Articles"], ["guide", "Guides"]];

function Blogs() {
  const params = useSearchParams();
  const kind = ["article", "guide"].includes(params.get("kind")) ? params.get("kind") : "";
  const { data, isLoading, isError, error } = useGetAllBlogsQuery(kind || undefined);
  const blogsData = data?.data?.attributes?.results;
  let content = null;
  if (isLoading) {
    content = <Loading />;
  } else if (!isLoading && isError && error) {
    content = (
      <h3 className="font-semibold text-rose-500 text-center py-5">
        Something went wrong
      </h3>
    );
  } else if (!isError && !isError && blogsData?.length === 0) {
    content = (
      <h3 className="font-semibold text-rose-500 text-center py-5">
        No blogs found
      </h3>
    );
  } else if (!isError && !isError && blogsData?.length > 0) {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {blogsData?.map((item) => (
          <BlogCard key={item?.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <>
      <PrimaryLayout>
        <Breadcrumb
          title={"Qwlee All Blog"}
          pathTitle={"Blog"}
          path={"/blogs"}
        />
        <div className="container py-10 md:py-16">
          <div role="tablist" aria-label="Show" className="mb-6 inline-flex rounded-full bg-gray-100 p-1">
            {TABS.map(([k, label]) => (
              <Link
                key={k || "all"}
                role="tab"
                aria-selected={kind === k}
                href={k ? `/blogs?kind=${k}` : "/blogs"}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${kind === k ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {content}
        </div>
      </PrimaryLayout>
    </>
  );
}

export default function BlogsPage() {
  return (
    <Suspense fallback={null}>
      <Blogs />
    </Suspense>
  );
}
