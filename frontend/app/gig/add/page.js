import GigWizard from "@/components/GigWizard/GigWizard";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "Create a gig | Qwlee",
  description: "Create a new service listing on Qwlee.",
};

export default function Page() {
  return (
    <PrimaryLayout>
      <GigWizard mode="create" />
    </PrimaryLayout>
  );
}
