// /profile — the signed-in user's own profile, served as the public
// /<username> route. Mirrors Fiverr: your "profile" IS your public
// profile, just with owner controls layered on top. Redirect on mount
// so the rest of the codebase only has one profile UI to maintain.

import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Profile from "@/components/Profile/Profile";

export const metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <PrimaryLayout>
      <Profile />
    </PrimaryLayout>
  );
}
