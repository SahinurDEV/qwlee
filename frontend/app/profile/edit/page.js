import EditProfile from "@/components/EditProfile/EditProfile";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = {
  title: "Edit Profile",
}
const page = () => {
  return (
    <PrimaryLayout>
      <EditProfile />
    </PrimaryLayout>
  );
};

export default page;
