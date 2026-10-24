"use client";
// Grid replacement for the Swiper-based section. Pulls top freelancers
// from the real /v1/users?role=freelancer endpoint and renders up to 8
// in a responsive grid. Cleaner header, no horizontal scroll required.

import { useI18n } from "@/components/Context/I18nProvider";
import { useRouter } from "next/navigation";
import { MdArrowForward } from "react-icons/md";
import Image from "next/image";
import FreelancersCard from "./FreelancersCard";
import FreelancersCardSkeleton from "./FreelancersCardSkeleton";
import { useGetAllUsersQuery } from "@/app/redux/features/getAllUsersApi";
import { RevealStagger, RevealItem } from "@/components/common/Reveal";

export default function MostPopularFreelancers() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, isLoading, isError } = useGetAllUsersQuery({ limit: 8 });
  const freelancers = data?.data?.attributes?.results || [];

  let body = null;
  if (isLoading) {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <FreelancersCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (isError || freelancers.length === 0) {
    body = (
      <div className="flex flex-col items-center text-center py-10">
        <Image width={200} height={200} src="/not-data.svg" alt="" />
        <p className="mt-2 text-gray-600">No freelancers yet</p>
      </div>
    );
  } else {
    body = (
      <RevealStagger
        gap={0.05}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5"
      >
        {freelancers.slice(0, 8).map((u) => (
          // h-full on the motion wrapper so the inner card's `h-full`
          // resolves to the grid cell height (each row stretches by
          // default in CSS Grid).
          <RevealItem key={u.id || u._id} className="h-full">
            <FreelancersCard data={u} />
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
              {t("Popular freelancers")}
            </h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">
              Hand-picked sellers with great reviews and fast response.
            </p>
          </div>
          <button
            onClick={() => router.push("/hire-freelancers")}
            className="hidden md:inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-sm"
          >
            See all <MdArrowForward />
          </button>
        </div>

        {body}

        <div className="md:hidden mt-6 text-center">
          <button
            onClick={() => router.push("/hire-freelancers")}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 font-medium hover:bg-emerald-50 transition"
          >
            See all freelancers <MdArrowForward />
          </button>
        </div>
      </div>
    </section>
  );
}
