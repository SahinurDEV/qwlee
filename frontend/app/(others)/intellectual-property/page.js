import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import IntellectualProperty from "@/components/Policy/IntellectualProperty";

export const metadata = {
  title: "Intellectual property",
  alternates: { canonical: "/intellectual-property" },
};

export default function Page() {
  return (
    <PrimaryLayout>
      <IntellectualProperty />
    </PrimaryLayout>
  );
}
