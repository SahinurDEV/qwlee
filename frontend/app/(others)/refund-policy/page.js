import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import RefundPolicy from "@/components/Policy/RefundPolicy";

export const metadata = {
  title: "Refunds & cancellations",
  alternates: { canonical: "/refund-policy" },
};

export default function Page() {
  return (
    <PrimaryLayout>
      <RefundPolicy />
    </PrimaryLayout>
  );
}
