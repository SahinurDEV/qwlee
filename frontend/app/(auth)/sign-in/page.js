import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import SignIn from "@/components/SignIn/SignIn";

export const metadata = {
  title: "Sign In",
}

const page = () => {
  return (
    <>
      <PrimaryLayout>
        <SignIn />
      </PrimaryLayout>
    </>
  );
};

export default page;
