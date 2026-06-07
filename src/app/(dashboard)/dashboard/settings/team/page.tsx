import { getTeamMembers } from "@/actions/team";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TeamClient } from "./team-client";

export default async function TeamSettingsPage() {
  const { members, roles } = await getTeamMembers();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 h-12 mb-6">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Team & Roles</h1>
      </div>

      <TeamClient members={members} roles={roles} />
    </div>
  );
}
