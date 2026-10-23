import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Talent from "@/components/Talent/Talent";

export const metadata = { title: "Find talent" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Talent />
      </Suspense>
    </PrimaryLayout>
  );
}
