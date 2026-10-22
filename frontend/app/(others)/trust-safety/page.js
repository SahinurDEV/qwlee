import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Trust from "@/components/Others/Trust";
export const metadata = {
  title: "Trust Safety",
};

const page = () => {
  return (
    <>
      <PrimaryLayout>
        <Breadcrumb
          title={"Qwlee Trust Safety"}
          pathTitle={"Trust Safety"}
          path={"/trust-safety"}
        />
      <Trust/>
      </PrimaryLayout>
    </>
  );
};

export default page;
