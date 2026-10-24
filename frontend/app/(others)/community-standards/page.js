import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import CommunityStandards from "@/components/Policy/CommunityStandards";

export const metadata = {
  title: "Community Standards",
  alternates: { canonical: "/community-standards" },
};

export default function Page() {
  return (
    <PrimaryLayout>
      <CommunityStandards />
    </PrimaryLayout>
  );
}
