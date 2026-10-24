import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SellerLevelPage from "@/components/SellerLevel/SellerLevelPage";

export const metadata = { title: "Seller levels", alternates: { canonical: "/seller-level" } };

export default function Page() {
  return (
    <PrimaryLayout>
      <SellerLevelPage />
    </PrimaryLayout>
  );
}
