import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Contests from "@/components/Contests/Contests";

export const metadata = { title: "Contests" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Contests />
      </Suspense>
    </PrimaryLayout>
  );
}
