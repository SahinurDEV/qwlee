import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import HelpCentre from "@/components/Help/HelpCentre";

export const metadata = { title: "Help centre", description: "Answers about orders, payments, selling and your Qwlee account." };

export default function Page() {
  return (
    <PrimaryLayout>
      <HelpCentre />
    </PrimaryLayout>
  );
}
