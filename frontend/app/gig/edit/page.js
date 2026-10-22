import { Suspense } from "react";
import EditGigWizard from "@/components/GigWizard/EditGigWizard";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "Edit gig | Qwlee",
  description: "Update your Qwlee gig.",
};

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <EditGigWizard />
      </Suspense>
    </PrimaryLayout>
  );
}
