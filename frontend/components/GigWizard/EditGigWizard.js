"use client";
import { useSearchParams } from "next/navigation";
import { useGetSingleGigQuery } from "@/app/redux/features/getSingleGigApi";
import GigWizard from "./GigWizard";

export default function EditGigWizard() {
  const id = useSearchParams().get("id");
  const { data, isLoading, isError } = useGetSingleGigQuery(id, { skip: !id });
  const gig = data?.data?.attributes?.gig;
  if (!id || isError) return <p className="mx-auto max-w-xl py-20 text-center text-gray-600">Gig not found.</p>;
  if (isLoading || !gig) return <p className="mx-auto max-w-xl py-20 text-center text-gray-500">Loading gig…</p>;
  return <GigWizard mode="edit" gig={gig} />;
}
