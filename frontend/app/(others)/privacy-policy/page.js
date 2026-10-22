import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Privacy from "@/components/Others/Privacy";
export const metadata = {
  title: "Privacy Policy",
};

const page = () => {
  return (
    <>
      <PrimaryLayout>
        <Breadcrumb
          title={"Qwlee Privacy Policy"}
          pathTitle={"Privacy Policy"}
          path={"/privacy-policy"}
        />
        <Privacy />
      </PrimaryLayout>
    </>
  );
};

export default page;
