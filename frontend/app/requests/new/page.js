import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import NewRequest from "@/components/Requests/NewRequest";

export const metadata = { title: "Post a request | Qwlee" };

export default function Page() {
  
  return (
    <PrimaryLayout>
      <NewRequest />
    </PrimaryLayout>
  );
}
