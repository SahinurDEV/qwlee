import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SignUp from "@/components/SignUp/SignUp";

export const metadata = {
  title: "Sign Up",
}
const page = () => {
  return (
    <>
      <PrimaryLayout>
        <SignUp />
      </PrimaryLayout>
    </>
  );
};

export default page;
