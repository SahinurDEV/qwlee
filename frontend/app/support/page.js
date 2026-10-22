import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SupportInbox from "@/components/Support/SupportInbox";

export const metadata = { title: "Help & support" };

export default function SupportPage() {
  return (
    <PrimaryLayout>
      <SupportInbox />
    </PrimaryLayout>
  );
}
