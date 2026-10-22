import ForgotPassword from "@/components/ForgotPassword/ForgotPassword";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "Forgot Password",
}
const page = () => {
  return (
    <PrimaryLayout>
      <ForgotPassword />
    </PrimaryLayout>
  );
};

export default page;
