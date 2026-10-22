import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import MyRequests from "@/components/Requests/MyRequests";

export const metadata = { title: "My requests | Qwlee" };

export default function Page() {
  
  return (
    <PrimaryLayout>
      <MyRequests />
    </PrimaryLayout>
  );
}
