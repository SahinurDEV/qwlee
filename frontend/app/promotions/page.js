import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Promotions from "@/components/Promotions/Promotions";

export const metadata = { title: "Promote your gigs" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Promotions />
      </Suspense>
    </PrimaryLayout>
  );
}
