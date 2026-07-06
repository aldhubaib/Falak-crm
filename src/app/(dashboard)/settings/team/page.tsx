import { getTeamMembers } from "@/actions/team";
import { AppHeader } from "@/components/app-header";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
  const { members, roles } = await getTeamMembers();

  return (
    <>
      <AppHeader title="Team" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TeamClient members={members} roles={roles} />
      </main>
    </>
  );
}
