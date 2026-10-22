import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Order from "@/components/Order/Order";

export const metadata = {
  title: "Order",
}
const page = () => {
  return (
    <PrimaryLayout>
      <Order />
    </PrimaryLayout>
  );
};

export default page;
