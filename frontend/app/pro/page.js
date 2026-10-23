import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Pro from "@/components/Pro/Pro";

export const metadata = { title: "Qwlee Pro" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <Pro />
      </Suspense>
    </PrimaryLayout>
  );
}
