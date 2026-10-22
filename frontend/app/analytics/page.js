import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SellerAnalytics from "@/components/Analytics/SellerAnalytics";

export const metadata = { title: "Analytics", robots: { index: false } };

export default function Page() {
  return (
    <PrimaryLayout>
      <SellerAnalytics />
    </PrimaryLayout>
  );
}
