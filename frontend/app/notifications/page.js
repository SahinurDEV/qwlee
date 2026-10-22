import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import NotificationsPage from "@/components/Notifications/NotificationsPage";

export const metadata = {
  title: "Notifications",
  description: "Every order, message, and payment event on your Qwlee account.",
};

export default function Page() {
  return (
    <PrimaryLayout>
      <NotificationsPage />
    </PrimaryLayout>
  );
}
