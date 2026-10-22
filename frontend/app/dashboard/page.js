import Dashboard from "@/components/Dashboard/Dashboard";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import React from "react";

export const metadata = {
  title: "Dashboard",
}
const page = () => {
  return (
    <PrimaryLayout>
      <Dashboard />
    </PrimaryLayout>
  );
};

export default page;
