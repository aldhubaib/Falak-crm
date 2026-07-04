import { AppHeader } from "@/components/app-header";
import { getBrandingAssets } from "@/actions/branding";
import { AppLogoClient } from "./app-logo-client";

export default async function AppLogoPage() {
  const assets = await getBrandingAssets();

  return (
    <>
      <AppHeader title="App Logo" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <AppLogoClient assets={assets} />
      </main>
    </>
  );
}
