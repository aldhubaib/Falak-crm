import { AppHeader } from "@/components/app-header";
import { getNotificationSound } from "@/actions/notification-sound";
import { NotificationSoundClient } from "./notification-sound-client";

export default async function NotificationSettingsPage() {
  const sound = await getNotificationSound();

  return (
    <>
      <AppHeader title="Notifications" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <NotificationSoundClient initial={sound} />
      </main>
    </>
  );
}
