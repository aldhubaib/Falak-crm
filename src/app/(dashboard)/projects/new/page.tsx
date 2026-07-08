import { getChecklistTemplates } from "@/actions/settings";
import { getDealOptions } from "@/actions/deals";
import { NewProjectClient } from "./new-project-client";

export default async function NewProjectPage() {
  const [templates, deals] = await Promise.all([
    getChecklistTemplates(),
    getDealOptions(),
  ]);

  return (
    <NewProjectClient
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        itemCount: t.items.length,
      }))}
      deals={deals
        // A deal backs at most one project — hide already-linked deals.
        .filter((d) => !d.project)
        .map((d) => ({
          id: d.id,
          title: d.title,
          companyName: d.company?.name ?? null,
          stageName: d.stage.name,
        }))}
    />
  );
}
