// Next 16 made dynamic-route `params` an async value — the route must
// await it before destructuring, otherwise the page errors at build time.

import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import OrderDetails from "@/components/Order/OrderDetails/OrderDetails";

export const metadata = {
  title: "Order",
};

export default async function OrderPage({ params }) {
  const { orderId } = await params;
  return (
    <PrimaryLayout>
      <OrderDetails orderId={orderId} />
    </PrimaryLayout>
  );
}
