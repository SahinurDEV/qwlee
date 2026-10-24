import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import BrowsingHistory from "@/components/History/BrowsingHistory";

export const metadata = {
  title: "Browsing history",
  robots: { index: false },
};

export default function Page() {
  return (
    <PrimaryLayout>
      <BrowsingHistory />
    </PrimaryLayout>
  );
}
