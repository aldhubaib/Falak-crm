import Link from "next/link";
import { Plus } from "lucide-react";
import { getPipeline } from "@/actions/deals";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DealsBoard } from "./deals-board";

export default async function DealsPage() {
  const pipeline = await getPipeline();

  if (!pipeline) {
    return (
      <>
        <AppHeader title="Deals" />
        <main className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No Pipeline"
            message="Create a pipeline in Settings first."
            action={
              <Button asChild size="sm">
                <Link href="/settings/pipelines">Go to Settings</Link>
              </Button>
            }
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Deals"
        actions={
          <Button asChild size="sm" className="rounded-full">
            <Link href="/deals/new">
              <Plus className="h-4 w-4" />
              New Deal
            </Link>
          </Button>
        }
      />
      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <DealsBoard pipeline={pipeline} />
      </main>
    </>
  );
}
