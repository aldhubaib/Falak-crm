import { getIntegrations } from "@/actions/integrations";
import { AppHeader } from "@/components/app-header";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage() {
  const { items, secretsKeyConfigured } = await getIntegrations();

  return (
    <>
      <AppHeader title="Integrations" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <IntegrationsClient
          integrations={items}
          secretsKeyConfigured={secretsKeyConfigured}
        />
      </main>
    </>
  );
}
