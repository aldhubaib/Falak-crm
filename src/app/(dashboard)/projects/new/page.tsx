import { getChecklistTemplates } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { NewProjectClient } from "./new-project-client";

export default async function NewProjectPage() {
  const templates = await getChecklistTemplates();

  return (
    <>
      <AppHeader title="New Project" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <NewProjectClient
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            itemCount: t.items.length,
          }))}
        />
      </main>
    </>
  );
}
