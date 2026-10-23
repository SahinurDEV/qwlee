import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Teams from "@/components/Teams/Teams";

export const metadata = { title: "Teams" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Teams />
      </Suspense>
    </PrimaryLayout>
  );
}
