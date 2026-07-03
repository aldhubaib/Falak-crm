import { getTeamMembers } from "@/actions/team";
import { AppHeader } from "@/components/app-header";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const { roles, members } = await getTeamMembers();

  return (
    <>
      <AppHeader title="Roles" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <RolesClient roles={roles} memberCounts={countByRole(roles, members)} />
      </main>
    </>
  );
}

function countByRole(
  roles: { id: string }[],
  members: { role: { id: string } | null }[],
) {
  const counts: Record<string, number> = {};
  for (const r of roles) counts[r.id] = 0;
  for (const m of members) {
    if (m.role) counts[m.role.id] = (counts[m.role.id] ?? 0) + 1;
  }
  return counts;
}
