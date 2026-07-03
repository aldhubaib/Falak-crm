import { getChecklistTemplates, getTaskStatuses } from "@/actions/settings";
import { AppHeader } from "@/components/app-header";
import { TaskTypesClient } from "./task-types-client";

export default async function TaskTypesPage() {
  const [templates, statuses] = await Promise.all([
    getChecklistTemplates(),
    getTaskStatuses(),
  ]);

  return (
    <>
      <AppHeader title="Task Types" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TaskTypesClient templates={templates} statuses={statuses} />
      </main>
    </>
  );
}
