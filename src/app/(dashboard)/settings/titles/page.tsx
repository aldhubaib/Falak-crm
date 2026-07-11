import { getTitlesData } from "@/actions/titles";
import { AppHeader } from "@/components/app-header";
import { TitlesClient } from "./titles-client";

export default async function TitlesPage() {
  const { titles, templates, reviewStages, memberCounts, isOwner } = await getTitlesData();

  return (
    <>
      <AppHeader title="Titles" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TitlesClient
          titles={titles.map((t) => ({
            id: t.id,
            name: t.name,
            fieldRates: t.fieldRates.map((r) => ({
              templateItemId: r.templateItemId,
              minutesPerUnit: r.minutesPerUnit,
            })),
            stageRates: t.stageRates.map((r) => ({
              statusId: r.statusId,
              minutesPerPass: r.minutesPerPass,
            })),
          }))}
          templates={templates
            .filter((t) => t.items.length > 0)
            .map((t) => ({
              id: t.id,
              name: t.name,
              items: t.items.map((i) => ({
                id: i.id,
                name: i.name,
                effortUnit: i.effortUnit as string,
                phase: i.phase,
              })),
            }))}
          reviewStages={reviewStages}
          memberCounts={memberCounts}
          isOwner={isOwner}
        />
      </main>
    </>
  );
}
