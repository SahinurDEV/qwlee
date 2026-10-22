// Next 16 made `searchParams` a Promise — must be awaited before
// destructuring. Pass the plain resolved object down to the client
// component (which also reads from useSearchParams for safety).

import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import OtpVerification from "@/components/OtpVerification/OtpVerification";

export const metadata = {
  title: "Verify Email",
};

export default async function VerifyEmail({ searchParams }) {
  const resolved = (await searchParams) || {};
  return (
    <PrimaryLayout>
      <OtpVerification searchParams={resolved} />
    </PrimaryLayout>
  );
}
