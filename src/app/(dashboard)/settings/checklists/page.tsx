import { getChecklistTemplates, getTaskStatuses } from "@/actions/settings";
import { ChecklistsClient } from "./checklists-client";

export default async function ChecklistsSettingsPage() {
  const [templates, taskStatuses] = await Promise.all([
    getChecklistTemplates(),
    getTaskStatuses(),
  ]);
  return <ChecklistsClient templates={templates} taskStatuses={taskStatuses} />;
}
