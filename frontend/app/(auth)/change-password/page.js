import ChangePassword from "@/components/ChangePassword/ChangePassword";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
export const metadata = {
  title: "Change Password",
};
const page = ({ searchParams }) => {
  return (
    <PrimaryLayout>
      <ChangePassword searchParams={searchParams} />
    </PrimaryLayout>
  );
};

export default page;
