"use client";
// Grid (not swiper) — the data set is small enough to render fully on
// every viewport. The old swiper hid 5+ categories behind a swipe gesture
// for no good reason.

import { useI18n } from "@/components/Context/I18nProvider";
import { MdArrowForward } from "react-icons/md";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CategoriesCard from "./CategoriesCard";
import CategoriesCardSkeleton from "./CategoriesCardSkeleton";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { RevealStagger, RevealItem } from "@/components/common/Reveal";

const MostPopularCategories = () => {
  const { t } = useI18n();
  const router = useRouter();
  const {
    data: responseCategoriesData,
    isLoading,
    isError,
  } = useGetAllCategoryQuery({});
  const categories = responseCategoriesData?.results || [];

  let body = null;
  if (isLoading) {
    body = (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <CategoriesCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (isError || categories.length === 0) {
    body = (
      <div className="flex flex-col items-center text-center">
        <Image width={200} height={200} src="/not-data.svg" alt="" />
        <p className="mt-2 text-gray-600">No categories yet</p>
      </div>
    );
  } else {
    body = (
      <RevealStagger
        gap={0.04}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4"
      >
        {categories.map((data) => (
          <RevealItem key={data.id}>
            <CategoriesCard data={data} />
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
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t("Browse by category")}
            </h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">
              Find a service that matches your project.
            </p>
          </div>
          <button
            onClick={() => router.push("/services")}
            className="hidden md:inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-sm"
          >
            All categories <MdArrowForward />
          </button>
        </div>
        {body}
      </div>
    </section>
  );
};

export default MostPopularCategories;
