import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import RequestsBoard from "@/components/Requests/RequestsBoard";

export const metadata = { title: "Buyer requests" };

export default function Page() {
  
  return (
    <PrimaryLayout>
      <RequestsBoard />
    </PrimaryLayout>
  );
}
