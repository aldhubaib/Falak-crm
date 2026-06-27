import { getProjectStatuses, getTaskStatuses } from "@/actions/settings";
import { StatusesClient } from "./statuses-client";

export default async function StatusesSettingsPage() {
  const [projectStatuses, taskStatuses] = await Promise.all([
    getProjectStatuses(),
    getTaskStatuses(),
  ]);
  return <StatusesClient projectStatuses={projectStatuses} taskStatuses={taskStatuses} />;
}
