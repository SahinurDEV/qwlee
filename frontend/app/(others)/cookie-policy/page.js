import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import CookiePolicy from "@/components/Policy/CookiePolicy";

export const metadata = { title: "Cookie Policy" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Breadcrumb title="Qwlee Cookie Policy" pathTitle="Cookie Policy" path="/cookie-policy" />
      <CookiePolicy />
    </PrimaryLayout>
  );
}
