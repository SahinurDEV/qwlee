import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import PaymentTerms from "@/components/Policy/PaymentTerms";

export const metadata = {
  title: "Payment terms",
  alternates: { canonical: "/payment-terms" },
};

export default function Page() {
  return (
    <PrimaryLayout>
      <PaymentTerms />
    </PrimaryLayout>
  );
}
