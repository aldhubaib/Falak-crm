import { getTeamMembers, getTestingRole } from "@/actions/team";
import { getTaskStatuses } from "@/actions/settings";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TeamClient } from "./team-client";

export default async function TeamSettingsPage() {
  const [{ members, roles }, taskStatuses, testingRoleId] = await Promise.all([
    getTeamMembers(),
    getTaskStatuses(),
    getTestingRole(),
  ]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
      </div>

      <TeamClient members={members} roles={roles} taskStatuses={taskStatuses} testingRoleId={testingRoleId} />
    </div>
  );
}
