import Link from "next/link";
import { Plus } from "lucide-react";
import { getPipeline } from "@/actions/deals";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DealsBoard } from "./deals-board";

export default async function DealsPage() {
  const [pipeline, { member }] = await Promise.all([
    getPipeline(),
    requireWorkspaceWithMember(),
  ]);
  const editable = canEdit(member, "deals");

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

  // Prisma Decimal isn't serializable across the Server→Client boundary, so
  // convert deal values to plain numbers before handing them to the board.
  const serializedPipeline = {
    ...pipeline,
    deals: pipeline.deals.map((d) => ({ ...d, value: Number(d.value) })),
  };

  return (
    <>
      <AppHeader
        title="Deals"
        actions={
          editable ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/deals/new">
                <Plus className="h-4 w-4" />
                New Deal
              </Link>
            </Button>
          ) : undefined
        }
      />
      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <DealsBoard pipeline={serializedPipeline} />
      </main>
    </>
  );
}
