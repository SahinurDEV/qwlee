import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Hourly from "@/components/Hourly/Hourly";

export const metadata = { title: "Hourly contracts" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Hourly />
      </Suspense>
    </PrimaryLayout>
  );
}
