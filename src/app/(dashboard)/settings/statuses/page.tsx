import { getProjectStatuses, getTaskStatuses } from "@/actions/settings";
import { getTeamMembers } from "@/actions/team";
import { StatusesClient } from "./statuses-client";

export default async function StatusesSettingsPage() {
  const [projectStatuses, taskStatuses, { roles }] = await Promise.all([
    getProjectStatuses(),
    getTaskStatuses(),
    getTeamMembers(),
  ]);
  return <StatusesClient projectStatuses={projectStatuses} taskStatuses={taskStatuses} roles={roles} />;
}
