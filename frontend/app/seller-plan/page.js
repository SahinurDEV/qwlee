import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SellerPlan from "@/components/SellerPlan/SellerPlan";

export const metadata = { title: "Seller plans" };

export default function Page() {
  return (
    <PrimaryLayout>
      <SellerPlan />
    </PrimaryLayout>
  );
}
