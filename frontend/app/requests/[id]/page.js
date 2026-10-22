import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import RequestDetail from "@/components/Requests/RequestDetail";

export const metadata = { title: "Request" };

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <PrimaryLayout>
      <RequestDetail id={id} />
    </PrimaryLayout>
  );
}
