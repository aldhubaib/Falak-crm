import Link from "next/link";
import { getPipeline } from "@/actions/deals";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DealsClient } from "./deals-client";

export default async function DealsPage() {
  const [pipeline, { member }] = await Promise.all([
    getPipeline(),
    requireWorkspaceWithMember(),
  ]);

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
  // convert deal values to plain numbers before handing them to the client.
  const serializedPipeline = {
    id: pipeline.id,
    name: pipeline.name,
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      type: s.type as string,
      order: s.order,
    })),
    deals: pipeline.deals.map((d) => ({
      id: d.id,
      title: d.title,
      value: Number(d.value),
      currency: d.currency,
      stageId: d.stageId,
      ownerName: d.ownerName,
      company: d.company,
      contact: d.contact
        ? { id: d.contact.id, firstName: d.contact.firstName, lastName: d.contact.lastName }
        : null,
      createdAt: d.createdAt.toISOString(),
    })),
  };

  return (
    <>
      <AppHeader title="Deals" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DealsClient
          pipeline={serializedPipeline}
          editable={canEdit(member, "deals")}
        />
      </main>
    </>
  );
}
