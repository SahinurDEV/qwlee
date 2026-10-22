import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Referrals from "@/components/Referrals/Referrals";

export const metadata = { title: "Invite friends", robots: { index: false } };

export default function Page() {
  return (
    <PrimaryLayout>
      <Referrals />
    </PrimaryLayout>
  );
}
