import AboutCards from "@/components/AboutUs/AboutCards";
import Breadcrumb from "@/components/Layout/Breadcrumb";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "About Us",
  description:
    "Our team of experienced professionals is dedicated to delivering exceptional testing services, backed by years of industry knowledge and expertise.",
};

function AboutUs() {
  return (
    <>
      <PrimaryLayout>
        <Breadcrumb
          title={"Qwlee About Us"}
          pathTitle={"About Us"}
          path={"/about-us"}
        />
        <AboutCards />
      </PrimaryLayout>
    </>
  );
}

export default AboutUs;
