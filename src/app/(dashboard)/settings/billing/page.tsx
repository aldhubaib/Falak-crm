import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { EmptyState } from "@/components/empty-state";

export default function BillingPage() {
  return (
    <>
      <AppHeader title="Billing" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-3xl">
          <EmptyState message="Billing settings coming soon." />
        </PageContainer>
      </main>
    </>
  );
}
