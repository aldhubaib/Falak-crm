import { AppHeader } from "@/components/app-header";
import { getLoginPhotos } from "@/actions/login-photos";
import { LoginSettingsClient } from "./login-settings-client";

export default async function LoginSettingsPage() {
  const photos = await getLoginPhotos();

  return (
    <>
      <AppHeader title="Login Page" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <LoginSettingsClient photos={photos} />
      </main>
    </>
  );
}
