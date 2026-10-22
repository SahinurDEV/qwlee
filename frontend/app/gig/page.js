import Gig from "@/components/Gig/Gig";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "Find services",
}
const page = () => {
  return (
    <PrimaryLayout>
      <Gig />
    </PrimaryLayout>
  );
};

export default page;
