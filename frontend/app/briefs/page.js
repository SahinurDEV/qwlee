import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import BriefBuilder from "@/components/Briefs/BriefBuilder";

export const metadata = { title: "Project brief | Qwlee" };

export default function BriefsPage() {
  return (
    <PrimaryLayout>
      <BriefBuilder />
    </PrimaryLayout>
  );
}
