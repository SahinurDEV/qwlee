import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Subscriptions from "@/components/Subscriptions/Subscriptions";

export const metadata = { title: "Subscriptions" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Subscriptions />
    </PrimaryLayout>
  );
}
