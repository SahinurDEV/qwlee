import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import TermsCondition from "@/components/Others/TermsCondition";

export const metadata = {
  title: "Terms of Service",
};
const page = () => {
  return (
    <>
      <PrimaryLayout>
        <Breadcrumb
          title={"Qwlee Terms of Service"}
          pathTitle={"Terms of Service"}
          path={"/terms-of-service"}
        />
     <TermsCondition/>
      </PrimaryLayout>
    </>
  );
};

export default page;
