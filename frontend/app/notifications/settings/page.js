import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import NotificationSettings from "@/components/Notifications/NotificationSettings";

export const metadata = { title: "Notification settings" };

export default function Page() {
  return (
    <PrimaryLayout>
      <NotificationSettings />
    </PrimaryLayout>
  );
}
