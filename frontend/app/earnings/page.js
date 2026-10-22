import Earnings from "@/components/Earnings/Earnings";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import React from "react";

export const metadata = {
  title: "Earnings",
}
const page = () => {
  return (
    <PrimaryLayout>
      <Earnings />
    </PrimaryLayout>
  );
};

export default page;
